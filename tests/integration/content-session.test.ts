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
import { watchFeedRoot } from '../../apps/extension/src/content/watch-root';
import { watchFeedNavigation } from '../../apps/extension/src/content/navigation';
import { createContentSession } from '../../apps/extension/src/content/session';

afterEach(() => vi.useRealTimers());

describe('desktop home feed navigation', () => {
  it.each([true, false])(
    'observes a committed navigation, suspends in the back-forward cache and disposes (navigation API: %s)',
    async (nativeNavigation) => {
      vi.useFakeTimers();
      const page = Object.assign(new EventTarget(), {
        location: new URL('https://www.linkedin.com/feed?sort=recent'),
        ...(nativeNavigation ? { navigation: new EventTarget() } : {}),
      });
      const signal = new AbortController();
      const leave = vi.fn();
      const enter = vi.fn(() => leave);
      watchFeedNavigation(page, enter, signal.signal);
      expect(enter).toHaveBeenCalledTimes(1);
      const navigate = async (path: string) => {
        page.location.href = new URL(path, page.location).href;
        page.navigation?.dispatchEvent(new Event('currententrychange'));
        await vi.advanceTimersByTimeAsync(400);
      };
      await navigate('/feed/update/123');
      expect(leave).toHaveBeenCalledTimes(1);
      await navigate('/in/someone');
      expect(enter).toHaveBeenCalledTimes(1);
      await navigate('/feed/');
      expect(enter).toHaveBeenCalledTimes(2);
      page.dispatchEvent(new Event('pagehide'));
      expect(leave).toHaveBeenCalledTimes(2);
      await navigate('/feed?sort=other');
      expect(enter).toHaveBeenCalledTimes(2);
      page.dispatchEvent(new Event('pageshow'));
      expect(enter).toHaveBeenCalledTimes(3);
      signal.abort();
      await navigate('/feed/');
      expect(enter).toHaveBeenCalledTimes(3);
      expect(leave).toHaveBeenCalledTimes(3);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
async function harness(
  options: {
    deferred?: boolean;
    text?: string;
    sponsored?: boolean;
    status?: Partial<PublicStatus>;
    beforeStatus?: BroadcastMessage;
    failClassification?: boolean;
  } = {},
) {
  vi.useFakeTimers();
  const sample = createSyntheticInput('engagement-bait');
  const { document } = parseHTML(
    '<html><body><main><div role="feed"><article class="feed-shared-update-v2" data-urn="urn:li:activity:123"><div class="update-components-text"></div></article></div></main></body></html>',
  );
  document.querySelector('.update-components-text')!.textContent =
    options.text ?? sample.text;
  const root = document.querySelector('[role="feed"]')! as HTMLElement;
  const post = root.querySelector('article')!;
  if (options.sponsored)
    post.insertAdjacentHTML(
      'afterbegin',
      '<span class="update-components-actor__sub-description">Sponsored</span>',
    );
  const original = root.innerHTML;
  let intersect: IntersectionObserverCallback | undefined;
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
    credentialConfigured: true,
    consentGranted: true,
    categoryModes: { ...createDefaultCategoryModes(), engagement_bait: 'hide' },
    state: 'ready',
    error: null,
    dailyRequestsUsed: 0,
    dailyRequestLimit: 10,
    resetAt: null,
    resetTimeZone: 'UTC',
    sessionHiddenCount: 0,
    ...options.status,
  };
  const requests: string[] = [];
  let readStatus = status;
  const send = async (
    request: Parameters<ContentClient['send']>[0],
  ): Promise<ReplyMessage> => {
    const base = { protocolVersion: 1 as const, requestId: request.requestId };
    requests.push(request.type);
    if (request.type === 'GET_PUBLIC_STATUS') {
      if (options.beforeStatus) broadcast(options.beforeStatus);
      return { ...base, type: 'PUBLIC_STATUS', status: readStatus };
    }
    if (request.type === 'CANCEL_SUBSCRIPTION')
      return { ...base, type: 'ACK', enablementGeneration: 1 };
    if (options.failClassification) throw new Error('timeout');
    const result = await createSyntheticClassifier().classify(
      { ...sample, requestId: request.requestId },
      { signal: new AbortController().signal },
    );
    if (options.deferred)
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
  const thresholds = createExperimentalThresholdProfile(
    'typesafe',
    SYNTHETIC_MODEL,
  );
  const watch = vi.fn((changed: (root: Element | null) => void) =>
    watchFeedRoot(document, changed),
  );
  const session = createContentSession({
    adapter,
    client,
    evaluate: createVisibilityEvaluator({ allowExperimental: true }),
    thresholds: (current) =>
      current.provider === thresholds.provider &&
      current.model === thresholds.model
        ? thresholds
        : null,
    supportedRoute: () => true,
    watchRoot: watch,
    requestId: () => `request-${++sequence}`,
  });
  await session.start();
  await vi.advanceTimersByTimeAsync(40);
  intersect?.(
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
    watch,
    setReadStatus(next: PublicStatus) {
      readStatus = next;
    },
    update(changes: Partial<PublicStatus>) {
      broadcast({
        protocolVersion: 1,
        requestId: 'settings',
        type: 'STATUS_CHANGED',
        status: { ...status, ...changes },
      });
    },
    requests,
    original,
    intersect: () =>
      intersect?.(
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
    expect(h.root.innerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('does not apply a delayed response after pause or dispose', async () => {
    const h = await harness({ deferred: true });
    expect(h.root.querySelector('article')!.outerHTML).toBe(h.original);
    h.pause();
    h.deliver();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.root.querySelector('article')!.outerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('leaves the feed untouched when consent is absent and attaches after consent', async () => {
    const h = await harness({ status: { consentGranted: false } });
    expect(h.root.innerHTML).toBe(h.original);
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS']);
    h.broadcast({
      protocolVersion: 1,
      requestId: 'consent',
      type: 'STATUS_CHANGED',
      status: { ...h.status, consentGranted: true, enablementGeneration: 2 },
    });
    await vi.advanceTimersByTimeAsync(40);
    h.intersect();
    await vi.advanceTimersByTimeAsync(40);
    expect(h.requests).toContain('CLASSIFY_POST');
    h.session.dispose();
  });
  it('honors a restore notification that precedes the initial status reply', async () => {
    const h = await harness({
      beforeStatus: {
        protocolVersion: 1,
        requestId: 'restore',
        type: 'RESTORE_ALL',
        reason: 'paused',
        enablementGeneration: 2,
      },
    });
    expect(h.root.innerHTML).toBe(h.original);
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS']);
    h.session.dispose();
  });
  it('skips classification when no categories are hidden', async () => {
    const h = await harness({
      status: { categoryModes: createDefaultCategoryModes() },
    });
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS']);
    expect(h.root.innerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('starts on the first Hide rule and restores on the last one within a generation', async () => {
    const h = await harness({
      status: { categoryModes: createDefaultCategoryModes() },
    });
    h.update({
      categoryModes: { ...h.status.categoryModes, engagement_bait: 'hide' },
    });
    await vi.advanceTimersByTimeAsync(40);
    h.intersect();
    await vi.advanceTimersByTimeAsync(40);
    expect(h.root.querySelector('article')!.hidden).toBe(true);
    h.update({ categoryModes: createDefaultCategoryModes() });
    expect(h.root.innerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('reuses current results when an organic category is protected', async () => {
    const h = await harness();
    h.update({
      categoryModes: {
        ...h.status.categoryModes,
        engagement_bait: 'always_show',
        technical_content: 'hide',
      },
    });
    expect(h.root.querySelector('article')!.hidden).toBe(false);
    h.update({ categoryModes: h.status.categoryModes });
    expect(h.root.querySelector('article')!.hidden).toBe(true);
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS', 'CLASSIFY_POST']);
    h.session.dispose();
  });
  it('cancels an in-flight request when the last organic hide rule is cleared', async () => {
    const h = await harness({ deferred: true });
    expect(h.root.querySelector('article')!.hidden).toBe(false);
    h.update({
      categoryModes: { ...createDefaultCategoryModes(), sponsored: 'hide' },
    });
    expect(h.requests).toEqual([
      'GET_PUBLIC_STATUS',
      'CLASSIFY_POST',
      'CANCEL_SUBSCRIPTION',
    ]);
    h.deliver();
    await vi.advanceTimersByTimeAsync(1);
    expect(h.root.innerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('ignores progress-only broadcasts after an unsuccessful classification', async () => {
    const h = await harness({ failClassification: true });
    h.update({
      categoryModes: { ...h.status.categoryModes },
      dailyRequestsUsed: 1,
    });
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS', 'CLASSIFY_POST']);
    h.session.dispose();
  });
  it('checks current same-generation status before observing a replacement root', async () => {
    const h = await harness();
    const nextRoot = h.root.cloneNode(false) as HTMLElement;
    h.root.replaceWith(nextRoot);
    h.setReadStatus({ ...h.status, enabled: false });
    const observe = vi.spyOn(h.adapter, 'observe');
    await vi.advanceTimersByTimeAsync(450);
    expect(observe).not.toHaveBeenCalled();
    expect(nextRoot.innerHTML).toBe('');
    h.session.dispose();
  });
  it('keeps disclosed sponsored posts visible and local under all rule combinations', async () => {
    const h = await harness({
      sponsored: true,
      status: {
        categoryModes: {
          ...createDefaultCategoryModes(),
          sponsored: 'hide',
          engagement_bait: 'hide',
        },
      },
    });
    expect(h.root.querySelector('article')!.hidden).toBe(false);
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS']);
    h.session.dispose();
  });
  it('does not look for feed roots before consent or after withdrawal', async () => {
    const h = await harness({ status: { consentGranted: false } });
    expect(h.watch).not.toHaveBeenCalled();
    h.update({ consentGranted: true, enablementGeneration: 2 });
    expect(h.watch).toHaveBeenCalledTimes(1);
    h.update({ consentGranted: false, enablementGeneration: 3 });
    const replacement = h.root.cloneNode(true) as HTMLElement;
    h.root.replaceWith(replacement);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.requests).toEqual(['GET_PUBLIC_STATUS']);
    expect(replacement.innerHTML).toBe(h.original);
    h.session.dispose();
  });
  it('restores immediately on a switch to an unsupported model', async () => {
    const h = await harness();
    const watchCount = h.watch.mock.calls.length;
    h.update({ model: 'unsupported', enablementGeneration: 2 });
    expect(h.root.innerHTML).toBe(h.original);
    expect(h.watch).toHaveBeenCalledTimes(watchCount);
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
