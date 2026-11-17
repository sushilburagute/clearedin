import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultCategoryModes,
  type BroadcastMessage,
  type ContentClient,
  type PublicStatus,
  type ReplyMessage,
} from '@clearedin/contracts';
import { createLinkedInAdapter } from '@clearedin/linkedin-adapter';
import {
  createExperimentalThresholdProfile,
  createVisibilityEvaluator,
} from '@clearedin/decision-engine';
import {
  createSyntheticClassifier,
  createSyntheticInput,
  SYNTHETIC_MODEL,
} from '@clearedin/test-fixtures/fake-classifier';
import { createContentSession } from '../../apps/extension/src/content/session';

afterEach(() => vi.useRealTimers());
async function harness(deferred = false) {
  vi.useFakeTimers();
  const sample = createSyntheticInput('engagement-bait');
  const { document } = parseHTML(
    '<html><body><main><div role="feed"><article class="feed-shared-update-v2" data-urn="urn:li:activity:123"><div class="update-components-text"></div></article></div></main></body></html>',
  );
  document.querySelector('.update-components-text')!.textContent = sample.text;
  const root = document.querySelector('[role="feed"]')! as HTMLElement;
  const post = root.querySelector('article')!;
  const original = root.innerHTML;
  let intersect!: IntersectionObserverCallback;
  const adapter = createLinkedInAdapter({
    url: () => new URL('https://www.linkedin.com/feed/'),
    digest: async (text) => createHash('sha256').update(text).digest('hex'),
    observers: {
      mutation: () => ({ observe() {}, disconnect() {} }),
      intersection(callback) {
        intersect = callback;
        return { observe() {}, unobserve() {}, disconnect() {} };
      },
    },
  });
  let broadcast!: (event: BroadcastMessage) => void;
  let deliver: (() => void) | undefined;
  const status: PublicStatus = {
    enabled: true,
    enablementGeneration: 1,
    provider: 'typesafe',
    model: SYNTHETIC_MODEL,
    credentialConfigured: false,
    consentGranted: true,
    categoryModes: { ...createDefaultCategoryModes(), engagement_bait: 'hide' },
    state: 'ready',
    error: null,
    dailyRequestsUsed: 0,
    dailyRequestLimit: 10,
    resetAt: null,
    resetTimeZone: 'UTC',
    sessionHiddenCount: 0,
  };
  const send = async (
    request: Parameters<ContentClient['send']>[0],
  ): Promise<ReplyMessage> => {
    const base = { protocolVersion: 1 as const, requestId: request.requestId };
    if (request.type === 'GET_PUBLIC_STATUS')
      return { ...base, type: 'PUBLIC_STATUS', status };
    if (request.type === 'CANCEL_SUBSCRIPTION')
      return { ...base, type: 'ACK', enablementGeneration: 1 };
    const result = await createSyntheticClassifier().classify(
      { ...sample, requestId: request.requestId },
      { signal: new AbortController().signal },
    );
    if (deferred)
      await new Promise<void>((resolve) => {
        deliver = resolve;
      });
    return {
      ...base,
      type: 'CLASSIFICATION_RESULT',
      identity: request.post.identity,
      enablementGeneration: request.enablementGeneration,
      result,
    };
  };
  // This fixture responds to each typed content command; production validates at IPC.
  const client: ContentClient = {
    send: send as ContentClient['send'],
    subscribe(listener) {
      broadcast = listener;
      return () => {};
    },
  };
  let sequence = 0;
  const session = createContentSession({
    adapter,
    client,
    evaluate: createVisibilityEvaluator({ allowExperimental: true }),
    thresholds: createExperimentalThresholdProfile('typesafe', SYNTHETIC_MODEL),
    supportedRoute: () => true,
    rescan: () => adapter.discover(),
    requestId: () => `request-${++sequence}`,
  });
  await session.start(root);
  await vi.advanceTimersByTimeAsync(40);
  intersect(
    [
      {
        target: post,
        isIntersecting: true,
      } as unknown as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver,
  );
  await vi.advanceTimersByTimeAsync(40);
  return {
    root,
    original,
    intersect: () =>
      intersect(
        [
          {
            target: post,
            isIntersecting: true,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    session,
    adapter,
    deliver: () => deliver?.(),
    pause: () =>
      broadcast({
        protocolVersion: 1,
        requestId: 'pause',
        type: 'STATUS_CHANGED',
        status: { ...status, enabled: false, enablementGeneration: 2 },
      }),
    status,
    broadcast,
  };
}

describe('real DOM adapter + content session + synthetic classifier + policy', () => {
  it('rediscovers posts after resume and keeps revealed posts visible', async () => {
    const h = await harness();
    h.pause();
    h.broadcast({
      protocolVersion: 1,
      requestId: 'resume',
      type: 'STATUS_CHANGED',
      status: { ...h.status, enablementGeneration: 3 },
    });
    await vi.advanceTimersByTimeAsync(40);
    h.intersect();
    await vi.advanceTimersByTimeAsync(40);
    expect(h.root.querySelector('article')!.hasAttribute('hidden')).toBe(true);
    h.root
      .querySelector('[data-clearedin-owned="placeholder"]')!
      .shadowRoot!.querySelector<HTMLButtonElement>('button')!
      .click();
    expect(h.root.querySelector('article')!.hasAttribute('hidden')).toBe(false);
    h.broadcast({
      protocolVersion: 1,
      requestId: 'update',
      type: 'STATUS_CHANGED',
      status: { ...h.status, enablementGeneration: 3 },
    });
    await vi.advanceTimersByTimeAsync(40);
    expect(h.root.querySelector('article')!.hasAttribute('hidden')).toBe(false);
    h.session.dispose();
  });
  it('collapses a synthetic post and exactly restores it on pause', async () => {
    const h = await harness();
    expect(h.root.querySelector('article')!.hasAttribute('hidden')).toBe(true);
    h.pause();
    expect(h.root.querySelector('article')!.outerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('does not apply a delayed response after pause or dispose', async () => {
    const h = await harness(true);
    expect(h.root.querySelector('article')!.outerHTML).toBe(h.original);
    h.pause();
    h.deliver();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.root.querySelector('article')!.outerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('restores on teardown and ignores older status broadcasts', async () => {
    const h = await harness();
    h.pause();
    h.broadcast({
      protocolVersion: 1,
      requestId: 'stale',
      type: 'STATUS_CHANGED',
      status: h.status,
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(h.root.querySelector('article')!.outerHTML).toBe(h.original);
    h.session.dispose();
    expect(h.root.innerHTML).toBe(h.original);
  });
});
