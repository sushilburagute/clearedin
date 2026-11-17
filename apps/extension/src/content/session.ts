import type {
  ClassificationResult,
  ContentClient,
  ExtractedPost,
  ExtractionAdapter,
  PostIdentity,
  PublicStatus,
  ThresholdProfile,
  EvaluateVisibility,
} from '@clearedin/contracts';

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
  let healthy = false;
  let disposed = false;
  let revision = 0;
  const posts = new Map<
    string,
    {
      post: ExtractedPost;
      revealed: boolean;
      result: ClassificationResult | null;
      requestId: string | null;
    }
  >();
  const identityKey = (identity: PostIdentity) => JSON.stringify(identity);
  function apply(entry: typeof posts extends Map<string, infer T> ? T : never) {
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
  function cancel(
    entry: typeof posts extends Map<string, infer T> ? T : never,
  ) {
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
    ++revision;
    for (const entry of posts.values()) cancel(entry);
    input.adapter.restoreAll();
  }
  async function classify(
    entry: typeof posts extends Map<string, infer T> ? T : never,
  ) {
    if (
      !status?.enabled ||
      !status.consentGranted ||
      !healthy ||
      !input.supportedRoute() ||
      disposed ||
      entry.revealed ||
      entry.result !== null ||
      entry.requestId
    )
      return;
    const epoch = revision;
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
      if (
        disposed ||
        revision !== epoch ||
        !status.enabled ||
        !status.consentGranted ||
        status.enablementGeneration !== generation ||
        posts.get(identityKey(entry.post.identity)) !== entry ||
        entry.revealed
      )
        return;
      if (
        reply.type !== 'CLASSIFICATION_RESULT' ||
        reply.enablementGeneration !== generation ||
        identityKey(reply.identity) !== identityKey(entry.post.identity)
      ) {
        input.adapter.restore(entry.post.identity);
        return;
      }
      entry.result = reply.result;
      apply(entry);
    } catch {
      if (posts.get(identityKey(entry.post.identity)) === entry)
        input.adapter.restore(entry.post.identity);
    } finally {
      if (entry.requestId === id) entry.requestId = null;
    }
  }
  function update(next: PublicStatus) {
    if (status && next.enablementGeneration < status.enablementGeneration)
      return;
    if (
      !next.enabled ||
      !next.consentGranted ||
      next.enablementGeneration !== status?.enablementGeneration
    )
      restore();
    status = next;
    if (next.enabled && next.consentGranted && input.supportedRoute())
      input.rescan();
    for (const entry of posts.values()) {
      apply(entry);
      void classify(entry);
    }
  }
  const unsubscribe = input.client.subscribe((event) => {
    if (event.type === 'RESTORE_ALL') {
      if (status && event.enablementGeneration >= status.enablementGeneration) {
        status = {
          ...status,
          enabled: false,
          enablementGeneration: event.enablementGeneration,
        };
        restore();
      }
    } else update(event.status);
  });
  const controller = new AbortController();
  return {
    async start(root: Element) {
      const reply = await input.client.send({
        protocolVersion: 1,
        requestId: input.requestId(),
        type: 'GET_PUBLIC_STATUS',
      });
      if (disposed || reply.type !== 'PUBLIC_STATUS') return;
      update(reply.status);
      input.adapter.observe(
        root,
        {
          onPost(post) {
            const key = identityKey(post.identity);
            const previous = posts.get(key);
            if (previous) return;
            const entry = {
              post,
              revealed: false,
              result: null,
              requestId: null,
            };
            posts.set(key, entry);
            apply(entry);
            void classify(entry);
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
                apply(entry);
                void classify(entry);
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
        },
        controller.signal,
      );
    },
    routeChanged() {
      restore();
      if (!input.supportedRoute()) posts.clear();
      else if (status?.enabled && status.consentGranted) input.rescan();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restore();
      controller.abort();
      unsubscribe();
      input.adapter.dispose();
      posts.clear();
    },
  };
}
