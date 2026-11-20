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
import { CATEGORY_IDS, REMOTE_CATEGORY_IDS } from '@clearedin/contracts';

interface SessionPost {
  post: ExtractedPost;
  revealed: boolean;
  result: ClassificationResult | null;
  requestId: string | null;
}

/** Runtime-independent lifecycle, exercised against synthetic DOM and transport. */
export function createContentSession(input: {
  adapter: ExtractionAdapter;
  client: ContentClient;
  evaluate: EvaluateVisibility;
  thresholds: ThresholdProfile | null;
  supportedRoute(): boolean;
  rescan(): void;
  requestId(): string;
}) {
  let status: PublicStatus | null = null;
  let latestGeneration = -1;
  let broadcastRevision = 0;
  let startSequence = 0;
  let healthy = false;
  let disposed = false;
  let root: Element | null = null;
  let stopObserving: (() => void) | null = null;
  const controller = new AbortController();
  const posts = new Map<string, SessionPost>();
  const identityKey = (identity: PostIdentity) => JSON.stringify(identity);

  function apply(entry: SessionPost) {
    if (!status || disposed) return;
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
        localSponsored: entry.post.localSponsored,
        categoryModes: status.categoryModes,
        classification: entry.result,
        thresholds: input.thresholds,
      }),
    );
  }
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
  async function evaluatePost(entry: SessionPost) {
    if (
      !status?.enabled ||
      !status.consentGranted ||
      !healthy ||
      !input.supportedRoute() ||
      disposed ||
      entry.revealed ||
      entry.result !== null ||
      !input.thresholds ||
      input.thresholds.provider !== status.provider ||
      input.thresholds.model !== status.model ||
      entry.post.extraction !== 'complete' ||
      (entry.post.localSponsored &&
        status.categoryModes.sponsored === 'always_show')
    ) {
      cancel(entry);
      apply(entry);
      return;
    }
    const localHide =
      entry.post.localSponsored && status.categoryModes.sponsored === 'hide';
    const modes = status.categoryModes;
    const { categories } = input.thresholds;
    const relevantMode = localHide ? 'always_show' : 'hide';
    if (
      !REMOTE_CATEGORY_IDS.some(
        (category) => categories[category] && modes[category] === relevantMode,
      )
    ) {
      cancel(entry);
      apply(entry);
      return;
    }
    if (entry.requestId) return;
    // A remote protection rule can override even a reliable local Hide rule.
    // Keep the host visible while a decision is pending.
    input.adapter.restore(entry.post.identity);
    if (posts.get(identityKey(entry.post.identity)) !== entry) return;
    const generation = status.enablementGeneration;
    const id = input.requestId();
    entry.requestId = id;
    try {
      const reply = await input.client.send({
        protocolVersion: 1,
        requestId: id,
        type: 'CLASSIFY_POST',
        post: entry.post,
        enablementGeneration: generation,
      });
      if (entry.requestId !== id) return;
      if (
        reply.type !== 'CLASSIFICATION_RESULT' ||
        reply.enablementGeneration !== generation ||
        identityKey(reply.identity) !== identityKey(entry.post.identity)
      ) {
        apply(entry);
        return;
      }
      entry.result = reply.result;
      apply(entry);
    } catch {
      // A failed remote request still leaves independent local rules in effect.
      if (entry.requestId === id) apply(entry);
    } finally {
      if (entry.requestId === id) entry.requestId = null;
    }
  }
  const callbacks: ExtractionCallbacks = {
    onPost(post) {
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
      else
        for (const entry of posts.values()) {
          void evaluatePost(entry);
        }
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
  function activate() {
    if (
      !root ||
      !status?.enabled ||
      !status.consentGranted ||
      !input.supportedRoute() ||
      !Object.values(status.categoryModes).includes('hide')
    )
      return;
    if (stopObserving && healthy) input.rescan();
    else {
      stopObserving?.();
      stopObserving = input.adapter.observe(root, callbacks, controller.signal);
    }
  }
  function update(next: PublicStatus) {
    if (disposed || next.enablementGeneration < latestGeneration) return;
    latestGeneration = next.enablementGeneration;
    const previous = status;
    status = next;
    if (
      !previous ||
      next.enablementGeneration !== previous.enablementGeneration ||
      next.enabled !== previous.enabled ||
      next.consentGranted !== previous.consentGranted ||
      next.provider !== previous.provider ||
      next.model !== previous.model
    ) {
      restore();
      activate();
      return;
    }
    if (
      CATEGORY_IDS.every(
        (id) => previous.categoryModes[id] === next.categoryModes[id],
      )
    )
      return;
    if (!Object.values(next.categoryModes).includes('hide')) restore();
    else if (!Object.values(previous.categoryModes).includes('hide'))
      activate();
    else for (const entry of posts.values()) void evaluatePost(entry);
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
      latestGeneration = event.enablementGeneration;
      status = null;
      restore();
    } else update(event.status);
  });
  return {
    async start(nextRoot: Element) {
      if (disposed) return;
      const sequence = ++startSequence;
      const beforeRead = broadcastRevision;
      if (root !== nextRoot) {
        stopObserving?.();
        stopObserving = null;
        root = nextRoot;
      }
      const reply = await input.client.send({
        protocolVersion: 1,
        requestId: input.requestId(),
        type: 'GET_PUBLIC_STATUS',
      });
      if (disposed || sequence !== startSequence) return;
      // Prefer a broadcast delivered during the read when both have the same generation.
      if (
        reply.type === 'PUBLIC_STATUS' &&
        (beforeRead === broadcastRevision ||
          reply.status.enablementGeneration > latestGeneration)
      )
        update(reply.status);
      if (
        !stopObserving &&
        (reply.type === 'PUBLIC_STATUS' || beforeRead !== broadcastRevision)
      )
        activate();
    },
    routeChanged() {
      restore();
      stopObserving?.();
      stopObserving = null;
      activate();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restore();
      controller.abort();
      unsubscribe();
      input.adapter.dispose();
      root = null;
    },
  };
}
