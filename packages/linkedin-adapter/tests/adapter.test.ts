import { createHash } from 'node:crypto';
import { parseHTML } from 'linkedom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtractedPostSchema } from '@clearedin/contracts';
import type {
  ExtractedPost,
  ExtractionCallbacks,
  PostIdentity,
  VisibilityDecision,
} from '@clearedin/contracts';
import {
  SYNTHETIC_FEED_HTML,
  SYNTHETIC_REPOST_HTML,
} from '@clearedin/test-fixtures/dom';
import {
  createLinkedInAdapter,
  extractPostContent,
  supportsFeedRoute,
} from '../src';
import type { AdapterOptions, ObserverPorts } from '../src';

const hide: VisibilityDecision = {
  action: 'collapse',
  reason: 'category_hidden',
  matchedCategories: ['product_launch'],
};
const localHide: VisibilityDecision = {
  ...hide,
  matchedCategories: ['sponsored'],
};

function harness(html = SYNTHETIC_FEED_HTML, extra: AdapterOptions = {}) {
  vi.useFakeTimers();
  const { document, window } = parseHTML(html);
  const root = document.querySelector('[role="feed"]')! as HTMLElement;
  const post = root.querySelector('article')! as HTMLElement;
  const original = root.innerHTML;
  let mutationCallback: MutationCallback;
  let intersectionCallback: IntersectionObserverCallback;
  const mutationDisconnect = vi.fn();
  const intersectionDisconnect = vi.fn();
  const observe = vi.fn();
  const unobserve = vi.fn();
  const posts: ExtractedPost[] = [];
  const removed: PostIdentity[] = [];
  const reveal = vi.fn();
  const health: boolean[] = [];
  let currentURL = 'https://www.linkedin.com/feed/';
  let active: Element | null = null;
  Object.defineProperty(document, 'activeElement', {
    get: () => active,
    configurable: true,
  });
  const observers: ObserverPorts = {
    mutation(callback) {
      mutationCallback = callback;
      return { observe: vi.fn(), disconnect: mutationDisconnect };
    },
    intersection(callback, options) {
      expect(options.rootMargin).toMatch(/px 0px$/);
      intersectionCallback = callback;
      return { observe, unobserve, disconnect: intersectionDisconnect };
    },
  };
  const callbacks: ExtractionCallbacks = {
    onPost(value) {
      posts.push(ExtractedPostSchema.parse(value));
    },
    onRemoved(value) {
      removed.push(value);
    },
    onReveal: reveal,
    onHealthChanged(value) {
      health.push(value);
    },
  };
  const adapter = createLinkedInAdapter({
    observers,
    url: () => new URL(currentURL),
    digest: async (input) => createHash('sha256').update(input).digest('hex'),
    ...extra,
  });
  const abort = new AbortController();
  const stop = adapter.observe(root, callbacks, abort.signal);
  function intersect(node = post, isIntersecting = true) {
    intersectionCallback(
      [
        {
          target: node,
          isIntersecting,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  }
  function mutate(
    target: Node = post,
    type: MutationRecord['type'] = 'characterData',
    addedNodes: Node[] = [],
  ) {
    mutationCallback(
      [
        {
          target,
          type,
          addedNodes,
          removedNodes: [],
        } as unknown as MutationRecord,
      ],
      {} as MutationObserver,
    );
  }
  async function flush() {
    await vi.advanceTimersByTimeAsync(40);
  }
  async function start() {
    await flush();
    intersect();
    await flush();
    return posts.at(-1)!.identity;
  }
  return {
    document,
    window,
    root,
    post,
    original,
    adapter,
    abort,
    stop,
    posts,
    removed,
    reveal,
    health,
    observe,
    unobserve,
    mutationDisconnect,
    intersectionDisconnect,
    intersect,
    mutate,
    flush,
    start,
    setURL: (url: string) => {
      currentURL = url;
    },
    setFocus: (node: Element | null) => {
      active = node;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('feed extraction', () => {
  it('only supports the HTTPS LinkedIn home feed', () => {
    for (const address of [
      'https://www.linkedin.com/feed/',
      'https://www.linkedin.com/feed/?sort=recent',
      'https://www.linkedin.com/feed',
    ])
      expect(supportsFeedRoute(new URL(address))).toBe(true);
    for (const address of [
      'http://www.linkedin.com/feed/',
      'https://linkedin.com/feed/',
      'https://www.linkedin.com/feeds/',
      'https://www.linkedin.com/feed/update/abc',
      'https://www.linkedin.com/messaging/',
      'https://www.linkedin.com/in/me',
      'https://www.linkedin.com.evil.invalid/feed/',
      'https://user@www.linkedin.com/feed/',
    ])
      expect(supportsFeedRoute(new URL(address))).toBe(false);
  });
  it('minimizes text and never includes author, comments, message, hidden text, counts or tracking URLs', () => {
    const h = harness();
    const content = extractPostContent(h.post)!;
    expect(content.text).toBe(
      'Our synthetic compiler is ready. Read the parser benchmarks in this article.\n\nSynthetic parser benchmarks',
    );
    expect(content.localSponsored).toBe(true);
    expect(content.extraction).toBe('complete');
    expect(content.text).not.toMatch(
      /Author|comment|message|999|tracking|draft|controls/,
    );
    h.stop();
  });
  it('separates visible quote context without quoted author metadata', () => {
    const h = harness(SYNTHETIC_REPOST_HTML);
    const content = extractPostContent(h.post)!;
    expect(content.repostContext).toBe('visible_quote');
    expect(content.text).toBe(
      'My synthetic release notes.\n\nWe shipped a compiler. Here are the benchmark methods.',
    );
    h.stop();
  });
  it('fails open for duplicate body selectors and ignores impostor bodies in comments or author metadata', () => {
    const h = harness();
    const actor = h.post.querySelector('.update-components-actor')!;
    actor.insertAdjacentHTML(
      'beforeend',
      '<span class="update-components-text">Do not leak actor metadata</span>',
    );
    expect(extractPostContent(h.post)?.text).not.toContain('metadata');
    h.post.insertAdjacentHTML(
      'beforeend',
      '<div class="update-components-text">Ambiguous second body</div>',
    );
    expect(extractPostContent(h.post)).toBeNull();
    h.stop();
  });
  it('marks user-truncated, oversized and image-only material partial and removes visible URLs', () => {
    const h = harness();
    const body = h.post.querySelector('.update-components-text')!;
    body.textContent = 'Synthetic short text…';
    expect(extractPostContent(h.post)?.extraction).toBe('partial');
    body.textContent = 'x'.repeat(8_001);
    expect(extractPostContent(h.post)?.text.length).toBe(8_000);
    expect(extractPostContent(h.post)?.extraction).toBe('partial');
    body.textContent = 'Text https://example.invalid/tracking?secret=1 end';
    expect(extractPostContent(h.post)?.text).not.toContain('https');
    body.remove();
    h.post.querySelector('.feed-shared-article__title')!.remove();
    expect(extractPostContent(h.post)?.text).toBe('');
    expect(extractPostContent(h.post)?.extraction).toBe('partial');
    h.stop();
  });
  it('only recognizes one exact visible English sponsored disclosure in the outer post', () => {
    const h = harness();
    const marker = h.post.querySelector(
      '.update-components-actor__sub-description',
    )!;
    marker.textContent = 'Sponsored by a friend';
    expect(extractPostContent(h.post)?.localSponsored).toBe(false);
    marker.textContent = 'Promoted';
    marker.setAttribute('hidden', '');
    expect(extractPostContent(h.post)?.localSponsored).toBe(false);
    marker.removeAttribute('hidden');
    expect(extractPostContent(h.post)?.localSponsored).toBe(true);
    marker.innerHTML = '<span hidden>Promoted</span>';
    expect(extractPostContent(h.post)?.localSponsored).toBe(false);
    h.stop();
  });
  it('recognizes truncation controls even when the visible text has no ellipsis', () => {
    const h = harness();
    h.post.insertAdjacentHTML(
      'beforeend',
      '<button aria-expanded="false">See more</button>',
    );
    expect(extractPostContent(h.post)?.extraction).toBe('partial');
    const button = h.post.querySelector('[aria-expanded]')!;
    button.textContent = 'Post options';
    button.setAttribute('aria-haspopup', 'menu');
    expect(extractPostContent(h.post)?.extraction).toBe('complete');
    h.stop();
  });
  it('rejects oversized post trees before selector traversal and extraction', () => {
    const h = harness();
    h.post.insertAdjacentHTML('beforeend', '<span></span>'.repeat(2001));
    expect(extractPostContent(h.post)).toBeNull();
    h.stop();
  });
});

describe('lifecycle, identity and reversible rendering', () => {
  it('registers each of 200 existing posts across bounded discovery batches', async () => {
    const cards = Array.from(
      { length: 200 },
      (_, i) =>
        `<article class="feed-shared-update-v2" data-urn="urn:li:activity:${i}"><div class="update-components-text">Synthetic post ${i}</div></article>`,
    ).join('');
    const h = harness(
      `<html><body><main><div role="feed">${cards}</div></main></body></html>`,
    );
    await vi.advanceTimersByTimeAsync(2000);
    const observed = new Set(h.observe.mock.calls.map(([node]) => node));
    for (const article of h.root.querySelectorAll('article'))
      expect(observed.has(article)).toBe(true);
    h.stop();
  });
  it('skips marked advertisements before hashing and publishing live content', async () => {
    const digest = vi.fn(async (text: string) =>
      createHash('sha256').update(text).digest('hex'),
    );
    const h = harness(SYNTHETIC_FEED_HTML, { excludeSponsored: true, digest });
    await h.flush();
    h.intersect();
    await h.flush();
    expect(digest).not.toHaveBeenCalled();
    expect(h.posts).toEqual([]);
    expect(h.post.hidden).toBe(false);
    h.stop();
  });
  it('gates publication on visibility, cancels offscreen subscriptions, then re-emits on return', async () => {
    const digest = vi.fn(async (text: string) =>
      createHash('sha256').update(text).digest('hex'),
    );
    const h = harness(SYNTHETIC_FEED_HTML, { digest });
    await h.flush();
    expect(h.posts).toHaveLength(0);
    expect(digest).not.toHaveBeenCalled();
    h.intersect();
    await h.flush();
    expect(h.posts).toHaveLength(1);
    h.intersect(h.post, false);
    expect(h.removed).toHaveLength(1);
    h.adapter.apply(h.posts[0]!.identity, hide);
    expect(h.post.hidden).toBe(false);
    h.intersect();
    expect(h.posts).toHaveLength(2);
    h.stop();
  });
  it('does not read native hidden content even when a geometric intersection is reported', async () => {
    const h = harness();
    h.post.style.visibility = 'hidden';
    await h.flush();
    h.intersect();
    await h.flush();
    expect(h.posts).toHaveLength(0);
    h.stop();
  });
  it('tracks the visible placeholder after collapse and ignores late host intersections', async () => {
    const h = harness();
    const id = await h.start();
    h.adapter.apply(id, hide);
    const placeholder = h.root.querySelector<HTMLElement>(
      '[data-clearedin-owned="placeholder"]',
    )!;
    expect(h.observe).toHaveBeenCalledWith(placeholder);
    h.intersect(h.post, false);
    expect(h.removed).toHaveLength(0);
    h.intersect(placeholder, false);
    expect(h.removed).toEqual([id]);
    h.intersect(placeholder);
    expect(h.posts).toHaveLength(2);
    h.adapter.restore(id);
    expect(h.unobserve).toHaveBeenCalledWith(placeholder);
    expect(h.observe).toHaveBeenLastCalledWith(h.post);
    h.stop();
  });
  it('discards pending discovery and ignores mutations while paused', async () => {
    const h = harness();
    h.adapter.restoreAll();
    h.mutate(h.root, 'childList', [h.post]);
    await h.flush();
    h.intersect();
    await h.flush();
    expect(h.observe).not.toHaveBeenCalled();
    expect(h.posts).toHaveLength(0);
    h.adapter.discover();
    await h.start();
    expect(h.posts).toHaveLength(1);
    h.stop();
  });
  it('rechecks native visibility before publishing an asynchronous digest', async () => {
    let finish!: (hash: string) => void;
    const h = harness(SYNTHETIC_FEED_HTML, {
      digest: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await h.flush();
    h.intersect();
    h.root.hidden = true;
    finish('a'.repeat(64));
    await h.flush();
    expect(h.posts).toHaveLength(0);
    h.stop();
  });
  it('collapses all host content accessibly and restores exact attributes, markup and host listeners', async () => {
    const h = harness();
    const listener = vi.fn();
    h.post.addEventListener('click', listener);
    const id = await h.start();
    h.adapter.apply(id, hide);
    expect(h.post.hasAttribute('hidden')).toBe(true);
    expect(h.post.hasAttribute('inert')).toBe(true);
    expect(h.post.getAttribute('aria-hidden')).toBe('true');
    expect(h.post.style.display).toBe('none');
    const placeholder = h.root.querySelector(
      '[data-clearedin-owned="placeholder"]',
    )!;
    expect(placeholder.shadowRoot?.querySelector('button')?.textContent).toBe(
      'Show',
    );
    expect(
      placeholder.shadowRoot?.querySelector('section')?.textContent,
    ).toContain('Product launches');
    h.stop();
    expect(h.root.innerHTML).toBe(h.original);
    h.post.click();
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('does not re-hide revealed content after late results, scans or text expansion', async () => {
    const h = harness();
    const first = await h.start();
    h.adapter.apply(first, hide);
    const button = h.root
      .querySelector('[data-clearedin-owned="placeholder"]')!
      .shadowRoot!.querySelector('button')!;
    button.click();
    expect(h.reveal).toHaveBeenCalledWith(first);
    expect(h.post.hidden).toBe(false);
    h.adapter.apply(first, hide);
    expect(h.post.hidden).toBe(false);
    h.post.querySelector('.update-components-text')!.textContent =
      'Expanded synthetic text';
    h.mutate();
    await h.flush();
    const expanded = h.posts.at(-1)!.identity;
    expect(expanded.nodeGeneration).not.toBe(first.nodeGeneration);
    h.adapter.apply(expanded, hide);
    expect(h.post.hidden).toBe(false);
    h.stop();
  });
  it('checks recycled identity and text synchronously before debounce and restores old state', async () => {
    const h = harness();
    const old = await h.start();
    h.adapter.apply(old, hide);
    h.post.setAttribute('data-urn', 'urn:li:activity:9999');
    h.post.querySelector('.update-components-text')!.textContent =
      'New synthetic post';
    h.adapter.apply(old, hide);
    expect(h.post.hidden).toBe(false);
    await h.flush();
    const next = h.posts.at(-1)!.identity;
    expect(next.postId).not.toBe(old.postId);
    expect(next.nodeGeneration).not.toBe(old.nodeGeneration);
    h.adapter.apply(old, hide);
    expect(h.post.hidden).toBe(false);
    h.adapter.apply(next, hide);
    expect(h.post.hidden).toBe(true);
    h.stop();
  });
  it('preserves a page-session reveal across pause restoration and rediscovery', async () => {
    const h = harness();
    const first = await h.start();
    h.adapter.apply(first, hide);
    h.adapter.reveal(first);
    h.adapter.restoreAll();
    h.adapter.discover();
    await h.flush();
    h.intersect();
    await h.flush();
    const resumed = h.posts.at(-1)!.identity;
    expect(resumed.nodeGeneration).not.toBe(first.nodeGeneration);
    h.adapter.apply(resumed, hide);
    expect(h.post.hidden).toBe(false);
    h.post.setAttribute('data-urn', 'urn:li:activity:9999');
    h.mutate();
    await h.flush();
    h.adapter.apply(h.posts.at(-1)!.identity, hide);
    expect(h.post.hidden).toBe(true);
    h.stop();
  });
  it('rejects old results on body replacement and identity loss', async () => {
    const h = harness();
    const old = await h.start();
    const body = h.post.querySelector('.update-components-text')!;
    body.replaceWith(body.cloneNode(true));
    h.adapter.apply(old, hide);
    expect(h.post.hidden).toBe(false);
    await h.flush();
    const next = h.posts.at(-1)!.identity;
    h.adapter.apply(next, hide);
    expect(h.post.hidden).toBe(true);
    h.post.removeAttribute('data-urn');
    h.adapter.apply(next, hide);
    expect(h.post.hidden).toBe(false);
    h.stop();
  });
  it('uses per-instance identity for duplicate IDs and ephemeral IDs', async () => {
    const h = harness();
    const clone = h.post.cloneNode(true) as HTMLElement;
    h.root.append(clone);
    await h.flush();
    h.intersect();
    h.intersect(clone);
    await h.flush();
    expect(h.posts).toHaveLength(2);
    expect(h.posts[0]!.identity.postId).not.toBe(h.posts[1]!.identity.postId);
    expect(h.posts[0]!.identity.nodeGeneration).not.toBe(
      h.posts[1]!.identity.nodeGeneration,
    );
    h.adapter.apply(h.posts[0]!.identity, hide);
    expect(clone.hidden).toBe(false);
    h.stop();
  });
  it('discovers posts without source IDs and preserves their reveal across expansion', async () => {
    const h = harness(
      SYNTHETIC_FEED_HTML.replace(' data-urn="urn:li:activity:1001"', ''),
    );
    const id = await h.start();
    expect(id.postId).toMatch(/^ephemeral:/);
    h.adapter.apply(id, hide);
    h.adapter.reveal(id);
    h.post.querySelector('.update-components-text')!.textContent =
      'Expanded synthetic post with no source ID';
    h.mutate();
    await h.flush();
    const expanded = h.posts.at(-1)!.identity;
    expect(expanded.nodeGeneration).not.toBe(id.nodeGeneration);
    h.adapter.apply(expanded, hide);
    expect(h.post.hidden).toBe(false);
    h.stop();
  });
  it('an old observe disposer cannot tear down a newer observation', async () => {
    const h = harness();
    const oldStop = h.stop;
    h.adapter.observe(
      h.root,
      {
        onPost: (value) => h.posts.push(value),
        onRemoved() {},
        onReveal() {},
        onHealthChanged() {},
      },
      h.abort.signal,
    );
    oldStop();
    await h.flush();
    h.intersect();
    await h.flush();
    expect(h.posts).toHaveLength(1);
    h.adapter.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('defers collapse until focus leaves and cancels deferral when shown', async () => {
    const h = harness();
    const id = await h.start();
    h.setFocus(h.post.querySelector('a'));
    h.adapter.apply(id, hide);
    expect(h.post.hidden).toBe(false);
    h.root.dispatchEvent(new h.window.Event('focusout'));
    h.setFocus(null);
    await h.flush();
    expect(h.post.hidden).toBe(true);
    h.adapter.restore(id);
    h.setFocus(h.post.querySelector('a'));
    h.adapter.apply(id, hide);
    h.adapter.apply(id, {
      action: 'show',
      reason: 'protected',
      matchedCategories: [],
    });
    h.setFocus(null);
    h.root.dispatchEvent(new h.window.Event('focusout'));
    await h.flush();
    expect(h.post.hidden).toBe(false);
    h.stop();
  });
  it('keeps partial posts visible except independently reliable local sponsored decisions', async () => {
    const h = harness();
    h.post.querySelector('.update-components-text')!.textContent = 'Partial…';
    const id = await h.start();
    h.adapter.apply(id, hide);
    expect(h.post.hidden).toBe(false);
    h.adapter.apply(id, localHide);
    expect(h.post.hidden).toBe(true);
    h.stop();
  });
  it('restores and retires identities on restoreAll, route changes, abort and disposal', async () => {
    const h = harness();
    const id = await h.start();
    h.adapter.apply(id, hide);
    h.adapter.restoreAll();
    expect(h.post.hidden).toBe(false);
    h.adapter.apply(id, hide);
    expect(h.post.hidden).toBe(false);
    h.adapter.discover();
    await h.flush();
    h.intersect();
    await h.flush();
    const next = h.posts.at(-1)!.identity;
    h.adapter.apply(next, hide);
    expect(h.post.hidden).toBe(true);
    h.setURL('https://www.linkedin.com/messaging/');
    h.adapter.apply(next, hide);
    expect(h.root.innerHTML).toBe(h.original);
    expect(h.mutationDisconnect).toHaveBeenCalled();
    expect(h.intersectionDisconnect).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    h.abort.abort();
    h.adapter.dispose();
  });
  it('restores detached nodes and reports cancellation without retaining observers', async () => {
    const h = harness();
    const id = await h.start();
    h.adapter.apply(id, hide);
    h.post.remove();
    h.mutate(h.root, 'childList');
    await h.flush();
    expect(h.post.hidden).toBe(false);
    expect(h.removed).toContainEqual(id);
    expect(h.unobserve).toHaveBeenCalledWith(h.post);
    h.stop();
  });
  it('restores the post if the host removes its reveal placeholder', async () => {
    const h = harness();
    const id = await h.start();
    h.adapter.apply(id, hide);
    h.root.querySelector('[data-clearedin-owned="placeholder"]')!.remove();
    h.mutate(h.root, 'childList');
    await h.flush();
    expect(h.post.hidden).toBe(false);
    expect(h.post.getAttribute('aria-hidden')).toBe('false');
    h.stop();
  });
  it('restores on ambiguous selectors and never publishes stale asynchronous digests', async () => {
    let finish: ((value: string) => void) | null = null;
    const h = harness(SYNTHETIC_FEED_HTML, {
      digest: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    await h.flush();
    h.intersect();
    h.abort.abort();
    finish!('a'.repeat(64));
    await Promise.resolve();
    expect(h.posts).toHaveLength(0);
    expect(h.root.innerHTML).toBe(h.original);
    const second = harness();
    const id = await second.start();
    second.adapter.apply(id, hide);
    second.post.insertAdjacentHTML(
      'beforeend',
      '<div class="update-components-text">Ambiguous</div>',
    );
    second.mutate();
    await second.flush();
    expect(second.post.hidden).toBe(false);
    expect(second.health.at(-1)).toBe(false);
    second.stop();
  });
  it('bounds hostile mutation batches and ignores extension-owned changes', async () => {
    const h = harness();
    const id = await h.start();
    h.adapter.apply(id, hide);
    const own = h.root.querySelector('[data-clearedin-owned="placeholder"]')!;
    h.mutate(own, 'childList');
    await h.flush();
    expect(h.posts).toHaveLength(1);
    h.mutate(
      h.root,
      'childList',
      Array.from({ length: 101 }, () => h.document.createElement('span')),
    );
    await h.flush();
    expect(h.post.hidden).toBe(false);
    expect(h.health.at(-1)).toBe(false);
    h.stop();
  });
});
