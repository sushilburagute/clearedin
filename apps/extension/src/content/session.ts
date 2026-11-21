import type {
  ClassificationResult,
  ContentClient,
  EvaluateVisibility,
  ExtractedPost,
  ExtractionAdapter,
  ExtractionCallbacks,
  PostIdentity,
  PublicStatus,
  ThresholdProfile,
} from '@clearedin/contracts';
import { REMOTE_CATEGORY_IDS } from '@clearedin/contracts';

interface SessionPost {
  post: ExtractedPost;
  revealed: boolean;
  result: ClassificationResult | null;
  requestId: string | null;
}

export function createContentSession(input: {
  adapter: ExtractionAdapter;
  client: ContentClient;
  evaluate: EvaluateVisibility;
  thresholds(status: PublicStatus): ThresholdProfile | null;
  supportedRoute(): boolean;
  watchRoot(changed: (root: Element | null) => void): () => void;
  requestId(): string;
}) {
  let status: PublicStatus | null = null;
  let thresholds: ThresholdProfile | null = null;
  let latestGeneration = -1;
  let broadcastRevision = 0;
  let readSequence = 0;
  let healthy = false;
  let disposed = false;
  let root: Element | null = null;
  let stopWatching: (() => void) | null = null;
  let stopObserving: (() => void) | null = null;
  const controller = new AbortController();
  const posts = new Map<string, SessionPost>();
  const identityKey = (identity: PostIdentity) => JSON.stringify(identity);

  function cancel(entry: SessionPost) {
    if (!entry.requestId) return;
    void input.client
      .send({
        protocolVersion: 1,
        requestId: input.requestId(),
        type: 'CANCEL_SUBSCRIPTION',
        classificationRequestId: entry.requestId,
      })
      .catch(() => undefined);
    entry.requestId = null;
  }

  function restore() {
    for (const entry of posts.values()) cancel(entry);
    posts.clear();
    input.adapter.restoreAll();
  }

  function stopFeed() {
    stopWatching?.();
    stopWatching = null;
    stopObserving?.();
    stopObserving = null;
    root = null;
    restore();
  }

  async function evaluatePost(entry: SessionPost) {
    if (
      !healthy ||
      !status ||
      !thresholds ||
      !input.supportedRoute() ||
      disposed
    )
      return;
    if (entry.revealed || entry.post.extraction !== 'complete') return;
    if (!entry.result) {
      if (entry.requestId) return;
      const id = input.requestId();
      const generation = status.enablementGeneration;
      entry.requestId = id;
      try {
        const reply = await input.client.send({
          protocolVersion: 1,
          requestId: id,
          type: 'CLASSIFY_POST',
          post: entry.post,
          enablementGeneration: generation,
        });
        if (
          entry.requestId !== id ||
          reply.type !== 'CLASSIFICATION_RESULT' ||
          reply.enablementGeneration !== generation ||
          identityKey(reply.identity) !== identityKey(entry.post.identity)
        )
          return;
        entry.result = reply.result;
      } catch {
        return;
      } finally {
        if (entry.requestId === id) entry.requestId = null;
      }
    }
    if (posts.get(identityKey(entry.post.identity)) !== entry) return;
    input.adapter.apply(
      entry.post.identity,
      input.evaluate({
        enabled: status.enabled,
        consentGranted: status.consentGranted,
        supportedRoute: input.supportedRoute(),
        validIdentity: true,
        extractorHealthy: healthy,
        revealed: entry.revealed,
        extraction: entry.post.extraction,
        localSponsored: false,
        categoryModes: status.categoryModes,
        classification: entry.result,
        thresholds,
      }),
    );
  }

  const callbacks: ExtractionCallbacks = {
    onPost(post) {
      if (post.localSponsored) return;
      const key = identityKey(post.identity);
      if (posts.has(key)) return;
      const entry = { post, revealed: false, result: null, requestId: null };
      posts.set(key, entry);
      void evaluatePost(entry);
    },
    onRemoved(identity) {
      const key = identityKey(identity);
      const entry = posts.get(key);
      if (entry) cancel(entry);
      posts.delete(key);
    },
    onHealthChanged(value) {
      healthy = value;
      if (!value) restore();
    },
    onReveal(identity) {
      const entry = posts.get(identityKey(identity));
      if (entry) {
        entry.revealed = true;
        cancel(entry);
        input.adapter.restore(identity);
      }
    },
  };

  function observe() {
    if (root && !stopObserving && input.supportedRoute())
      stopObserving = input.adapter.observe(root, callbacks, controller.signal);
  }

  function update(next: PublicStatus) {
    if (disposed || next.enablementGeneration < latestGeneration) return;
    const previous = status;
    latestGeneration = next.enablementGeneration;
    if (
      !previous ||
      previous.model !== next.model ||
      previous.provider !== next.provider
    )
      thresholds = input.thresholds(next);
    status = next;
    if (
      !next.enabled ||
      !next.consentGranted ||
      !next.credentialConfigured ||
      !thresholds ||
      !input.supportedRoute() ||
      !REMOTE_CATEGORY_IDS.some(
        (id) => next.categoryModes[id] === 'hide' && thresholds?.categories[id],
      )
    ) {
      stopFeed();
      return;
    }
    if (
      !previous ||
      previous.enablementGeneration !== next.enablementGeneration ||
      previous.provider !== next.provider ||
      previous.model !== next.model
    )
      stopFeed();

    if (!stopWatching) {
      let firstRoot = true;
      stopWatching = input.watchRoot((nextRoot) => {
        if (root === nextRoot || disposed) return;
        stopObserving?.();
        stopObserving = null;
        restore();
        root = nextRoot;
        if (!root) return;
        if (firstRoot) {
          firstRoot = false;
          observe();
        } else {
          // Recheck privileged state before attaching to a replacement tree.
          void readStatus();
        }
      });
    } else {
      observe();
      if (
        previous &&
        REMOTE_CATEGORY_IDS.some(
          (id) => previous.categoryModes[id] !== next.categoryModes[id],
        )
      )
        for (const entry of posts.values()) void evaluatePost(entry);
    }
  }

  async function readStatus() {
    const sequence = ++readSequence;
    const before = broadcastRevision;
    try {
      const reply = await input.client.send({
        protocolVersion: 1,
        requestId: input.requestId(),
        type: 'GET_PUBLIC_STATUS',
      });
      if (disposed || sequence !== readSequence) return;
      if (
        reply.type === 'PUBLIC_STATUS' &&
        (before === broadcastRevision ||
          reply.status.enablementGeneration > latestGeneration)
      )
        update(reply.status);
      else if (before === broadcastRevision) stopFeed();
    } catch {
      if (
        !disposed &&
        sequence === readSequence &&
        before === broadcastRevision
      )
        stopFeed();
    }
  }

  const unsubscribe = input.client.subscribe((event) => {
    if (disposed) return;
    const generation =
      event.type === 'RESTORE_ALL'
        ? event.enablementGeneration
        : event.status.enablementGeneration;
    if (generation < latestGeneration) return;
    ++broadcastRevision;
    if (event.type === 'RESTORE_ALL') {
      latestGeneration = generation;
      status = null;
      stopFeed();
    } else update(event.status);
  });

  return {
    start: readStatus,
    dispose() {
      if (disposed) return;
      disposed = true;
      stopFeed();
      controller.abort();
      unsubscribe();
      input.adapter.dispose();
    },
  };
}
