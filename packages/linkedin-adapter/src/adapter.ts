import type {
  ExtractionAdapter,
  ExtractionCallbacks,
  PostIdentity,
  VisibilityDecision,
} from '@clearedin/contracts';
import { PostIdentitySchema } from '@clearedin/contracts';
import {
  extractPostContent,
  localSourceId,
  SELECTORS,
  supportsFeedRoute,
} from './extraction';
import type { ExtractedContent } from './extraction';
import { collapsePost } from './render';
import type { RenderedPost } from './render';

export const EXTRACTOR_VERSION = '1.0.0';
const MAX_TRACKED = 250;
const BATCH_SIZE = 20;
const SCAN_BATCH = 200;
const MAX_PENDING = 100;

export interface ObserverPorts {
  mutation(
    callback: MutationCallback,
  ): Pick<MutationObserver, 'observe' | 'disconnect'>;
  intersection(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit,
  ): Pick<IntersectionObserver, 'observe' | 'unobserve' | 'disconnect'>;
}

export interface AdapterOptions {
  /** Skip marked advertisements before reading or hashing their body. */
  excludeSponsored?: boolean;
  /** Tests may inject observers/time/location; production defaults to the root's realm. */
  observers?: ObserverPorts;
  url?: () => URL;
  schedule?: (callback: () => void, delayMs: number) => () => void;
  digest?: (input: string) => Promise<string>;
}

export interface LinkedInAdapter extends ExtractionAdapter {
  /** Bounded discovery and extraction are also available for coordinator-driven rescans. */
  discover(): void;
  extract(node: Element): ExtractedContent | null;
  reveal(identity: PostIdentity): void;
  /** Call synchronously from the coordinator's SPA route hook; polling is a fallback. */
  routeChanged(): void;
}

interface State {
  node: HTMLElement;
  sourceId: string | null;
  sourceKey: string;
  postId: string;
  generation: number;
  content: ExtractedContent;
  bodyNodes: readonly Element[];
  identity: PostIdentity | null;
  visible: boolean;
  emitted: boolean;
  revealed: boolean;
  rendered: RenderedPost | null;
  pending: VisibilityDecision | null;
}

export function createLinkedInAdapter(
  options: AdapterOptions = {},
): LinkedInAdapter {
  let root: Element | null = null;
  let callbacks: ExtractionCallbacks | null = null;
  let mutation: ReturnType<ObserverPorts['mutation']> | null = null;
  let intersection: ReturnType<ObserverPorts['intersection']> | null = null;
  let generation = 0;
  let instance = 0;
  let observation = 0;
  let route = '';
  let healthy = false;
  let suspended = false;
  let cancelBatch: (() => void) | null = null;
  let cancelPoll: (() => void) | null = null;
  let releaseListeners = () => {};
  let liveRegion: HTMLElement | null = null;
  const focusTimers = new Set<() => void>();
  const states = new Map<Element, State>();
  const placeholderPosts = new WeakMap<Element, Element>();
  let reveals = new WeakMap<Element, string>();
  const candidates = new Set<Element>();
  const visibleCandidates = new Set<Element>();
  const pending = new Set<Element>();
  const scanRoots: Element[] = [];
  let walker: TreeWalker | null = null;
  const schedule =
    options.schedule ??
    ((callback: () => void, delay: number) => {
      const timer = globalThis.setTimeout(callback, delay);
      return () => globalThis.clearTimeout(timer);
    });
  const url = () =>
    options.url?.() ??
    new URL(root?.ownerDocument.defaultView?.location.href ?? 'about:blank');
  const digest =
    options.digest ??
    (async (input: string) => {
      const bytes = new TextEncoder().encode(input);
      const value = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(value), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    });

  function reportHealth(value: boolean) {
    if (healthy !== value) {
      healthy = value;
      callbacks?.onHealthChanged(value);
    }
  }
  function restore(state: State) {
    state.pending = null;
    if (!state.rendered) return;
    const { placeholder } = state.rendered;
    intersection?.unobserve(placeholder);
    placeholderPosts.delete(placeholder);
    state.rendered.restore();
    state.rendered = null;
    if (candidates.has(state.node)) intersection?.observe(state.node);
  }
  function withdraw(state: State) {
    if (state.emitted && state.identity)
      callbacks?.onRemoved({ ...state.identity });
    state.emitted = false;
  }
  function remove(state: State) {
    restore(state);
    withdraw(state);
    intersection?.unobserve(state.node);
    candidates.delete(state.node);
    visibleCandidates.delete(state.node);
    states.delete(state.node);
    if (!state.node.isConnected || !root?.contains(state.node))
      reveals.delete(state.node);
  }
  function stop() {
    cancelBatch?.();
    cancelBatch = null;
    cancelPoll?.();
    cancelPoll = null;
    mutation?.disconnect();
    mutation = null;
    intersection?.disconnect();
    intersection = null;
    releaseListeners();
    releaseListeners = () => {};
    for (const cancel of focusTimers) cancel();
    focusTimers.clear();
    for (const state of states.values()) remove(state);
    reveals = new WeakMap();
    candidates.clear();
    visibleCandidates.clear();
    pending.clear();
    scanRoots.length = 0;
    walker = null;
    liveRegion?.remove();
    liveRegion = null;
    reportHealth(false);
    root = null;
    callbacks = null;
  }
  function validRoute(): boolean {
    if (
      !root ||
      !root.isConnected ||
      url().href !== route ||
      !supportsFeedRoute(url())
    ) {
      if (root) stop();
      return false;
    }
    return true;
  }
  function signatureNodes(node: Element): Element[] {
    return Array.from(
      node.querySelectorAll(
        `${SELECTORS.body}, ${SELECTORS.quote}, ${SELECTORS.preview}`,
      ),
    );
  }
  function sameContent(state: State, content: ExtractedContent): boolean {
    const bodies = signatureNodes(state.node);
    return (
      state.sourceKey === sourceKey(state.node) &&
      state.content.digestInput === content.digestInput &&
      bodies.length === state.bodyNodes.length &&
      bodies.every((node, i) => node === state.bodyNodes[i])
    );
  }
  function sourceKey(node: Element): string {
    return JSON.stringify([
      node.getAttribute('data-urn'),
      node.getAttribute('data-id'),
    ]);
  }
  function canRead(node: Element): boolean {
    const tracked = states.get(node);
    if (
      tracked?.rendered &&
      (!tracked.rendered.placeholder.isConnected ||
        tracked.rendered.placeholder.parentNode !== node.parentNode ||
        tracked.rendered.placeholder.nextSibling !== node)
    )
      restore(tracked);
    if (!(
      root?.contains(node) &&
      node.isConnected &&
      node.matches(SELECTORS.post) &&
      !node.parentElement?.closest(SELECTORS.post) &&
      !node.closest(
        '[data-clearedin-owned], .msg-overlay-list-bubble, .comments-comments-list',
      ) &&
      !node.parentElement?.closest('[hidden], [inert], [aria-hidden="true"]')
    ))
      return false;
    let ancestor: Element | null = tracked?.rendered
      ? node.parentElement
      : node;
    while (ancestor) {
      if (ancestor.matches('[hidden], [inert], [aria-hidden="true"]'))
        return false;
      const style =
        ancestor.ownerDocument.defaultView?.getComputedStyle?.(ancestor) ??
        (ancestor as HTMLElement).style;
      if (
        style?.display === 'none' ||
        style?.visibility === 'hidden' ||
        style?.visibility === 'collapse'
      )
        return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  }
  function emit(state: State) {
    if (!healthy || !state.visible || state.emitted || !state.identity) return;
    state.emitted = true;
    callbacks?.onPost({
      identity: { ...state.identity },
      text: state.content.text,
      extraction: state.content.extraction,
      extractorVersion: EXTRACTOR_VERSION,
      localSponsored: state.content.localSponsored,
    });
  }
  function excludedSponsored(node: Element) {
    if (!options.excludeSponsored) return false;
    if (node.matches('[data-ad-id], [data-ad-tracking-id]')) return true;
    for (const marker of node.querySelectorAll(SELECTORS.sponsored)) {
      if (/\b(?:promoted|sponsored)\b/i.test(marker.textContent ?? ''))
        return true;
    }
    return false;
  }
  function refresh(node: Element): State | null {
    const old = states.get(node);
    if (!canRead(node)) {
      if (old) remove(old);
      return null;
    }
    // Discover containers first. Read text and hash only after visibility/lookahead
    // confirmation; existing states still refresh to restore reused hidden nodes.
    if (!old && !visibleCandidates.has(node)) return null;
    if (excludedSponsored(node)) {
      if (old) remove(old);
      return null;
    }
    const content = extractPostContent(node);
    if (!content) {
      if (old) remove(old);
      reportHealth(false);
      // Ambiguous selectors invalidate all currently hidden content, not just this post.
      for (const state of states.values()) restore(state);
      return null;
    }
    if (old && sameContent(old, content)) return old;
    const sourceId = localSourceId(node);
    // With no stable ID, preserve a reveal for this node lifetime rather than risk
    // hiding content the user explicitly revealed. A detach/source change retires it.
    const samePost =
      old && sourceId === old.sourceId && old.sourceKey === sourceKey(node);
    const revealed =
      (!!samePost && old.revealed) || reveals.get(node) === sourceKey(node);
    const visible = old?.visible ?? visibleCandidates.has(node);
    if (old) remove(old);
    if (states.size >= MAX_TRACKED) return null;
    const state: State = {
      node: node as HTMLElement,
      sourceId,
      sourceKey: sourceKey(node),
      postId: samePost
        ? old.postId
        : `${sourceId ?? 'ephemeral'}:instance-${++instance}`,
      generation: ++generation,
      content,
      bodyNodes: signatureNodes(node),
      identity: null,
      visible,
      emitted: false,
      revealed,
      rendered: null,
      pending: null,
    };
    states.set(node, state);
    candidates.add(node);
    if (visible) visibleCandidates.add(node);
    intersection?.observe(node);
    void digest(content.digestInput)
      .then((contentDigest) => {
        if (!validRoute() || states.get(node) !== state) return;
        if (!canRead(node) || excludedSponsored(node)) {
          remove(state);
          return;
        }
        const identity = PostIdentitySchema.safeParse({
          postId: state.postId,
          contentDigest,
          nodeGeneration: state.generation,
        });
        if (!identity.success) {
          reportHealth(false);
          for (const item of states.values()) restore(item);
          return;
        }
        // Re-read after asynchronous hashing so a mutation cannot publish stale input.
        const latest = extractPostContent(node);
        if (!latest || !sameContent(state, latest)) {
          enqueue(node);
          return;
        }
        state.identity = identity.data;
        emit(state);
      })
      .catch(() => {
        if (states.get(node) === state) {
          reportHealth(false);
          for (const item of states.values()) restore(item);
        }
      });
    return state;
  }
  function owned(node: Node): boolean {
    const element =
      node.nodeType === 1 ? (node as Element) : node.parentElement;
    return !!element?.closest('[data-clearedin-owned]');
  }
  function enqueue(node: Element) {
    if (pending.size >= MAX_PENDING) {
      overflow();
      return;
    }
    pending.add(node);
    requestBatch();
  }
  function addScan(node: Element) {
    if (scanRoots.length >= MAX_PENDING) {
      overflow();
      return;
    }
    scanRoots.push(node);
    requestBatch();
  }
  function overflow() {
    reportHealth(false);
    for (const state of states.values()) restore(state);
    pending.clear();
    scanRoots.length = 0;
    walker = null;
  }
  function requestBatch() {
    if (!suspended && !cancelBatch && root) cancelBatch = schedule(batch, 32);
  }
  function pruneCandidates() {
    for (const node of candidates)
      if (!canRead(node)) {
        const state = states.get(node);
        if (state) remove(state);
        else {
          intersection?.unobserve(node);
          candidates.delete(node);
          visibleCandidates.delete(node);
        }
      }
  }
  function batch() {
    cancelBatch = null;
    if (suspended || !validRoute()) return;
    pruneCandidates();
    let scanned = 0;
    while (scanned++ < SCAN_BATCH && (walker || scanRoots.length)) {
      if (!walker) {
        const start = scanRoots.shift()!;
        if (owned(start) || !root?.contains(start)) continue;
        walker = start.ownerDocument.createTreeWalker(start, 1);
        if (start.matches(SELECTORS.post)) pending.add(start);
      }
      const next = walker.nextNode() as Element | null;
      if (!next) {
        walker = null;
        continue;
      }
      if (
        !owned(next) &&
        next.matches(SELECTORS.post) &&
        pending.size < MAX_PENDING
      )
        pending.add(next);
    }
    let processed = 0;
    for (const node of pending) {
      pending.delete(node);
      if (
        canRead(node) &&
        !candidates.has(node) &&
        candidates.size < MAX_TRACKED
      ) {
        candidates.add(node);
        intersection?.observe(node);
      }
      if (candidates.has(node) || states.has(node)) refresh(node);
      if (++processed >= BATCH_SIZE) break;
    }
    if (pending.size || scanRoots.length || walker) requestBatch();
  }
  function find(identity: PostIdentity): State | null {
    if (
      !validRoute() ||
      !healthy ||
      !PostIdentitySchema.safeParse(identity).success
    )
      return null;
    for (const state of states.values()) {
      const current = state.identity;
      if (
        current?.postId !== identity.postId ||
        current.contentDigest !== identity.contentDigest ||
        current.nodeGeneration !== identity.nodeGeneration
      )
        continue;
      // Check current DOM before applying any asynchronous result, even before observer debounce.
      return refresh(state.node) === state ? state : null;
    }
    return null;
  }
  function focused(state: State): boolean {
    const active = state.node.ownerDocument.activeElement;
    return !!active && state.node.contains(active);
  }
  function reveal(identity: PostIdentity) {
    const state = find(identity);
    if (!state) return;
    const restoreFocus = !!state.rendered?.placeholder.contains(
      state.node.ownerDocument.activeElement,
    );
    state.revealed = true;
    reveals.set(state.node, state.sourceKey);
    restore(state);
    if (restoreFocus) {
      const original = state.node.getAttribute('tabindex');
      state.node.setAttribute('tabindex', '-1');
      state.node.focus({ preventScroll: true });
      if (original === null) state.node.removeAttribute('tabindex');
      else state.node.setAttribute('tabindex', original);
    }
    callbacks?.onReveal({ ...identity });
    if (liveRegion)
      liveRegion.textContent =
        'Post shown. It will stay visible for this page session.';
  }
  function apply(identity: PostIdentity, decision: VisibilityDecision) {
    const state = find(identity);
    if (!state) return;
    if (decision.action === 'show') {
      restore(state);
      return;
    }
    if (!state.visible || !state.emitted || state.revealed) return;
    if (
      decision.reason !== 'category_hidden' ||
      !decision.matchedCategories.length
    )
      return;
    const localOnly =
      state.content.localSponsored &&
      decision.matchedCategories.every((id) => id === 'sponsored');
    if (state.content.extraction === 'partial' && !localOnly) return;
    if (state.rendered) {
      state.rendered.updateCategories(decision.matchedCategories);
      return;
    }
    if (
      state.node.hasAttribute('hidden') ||
      state.node.hasAttribute('inert') ||
      state.node.getAttribute('aria-hidden') === 'true'
    )
      return;
    if (focused(state)) {
      state.pending = decision;
      return;
    }
    state.pending = null;
    state.rendered = collapsePost(state.node, decision.matchedCategories, () =>
      reveal(identity),
    );
    // display:none removes the host from intersection. Its replacement now
    // determines whether this post still has a visible subscriber.
    intersection?.unobserve(state.node);
    placeholderPosts.set(state.rendered.placeholder, state.node);
    intersection?.observe(state.rendered.placeholder);
  }

  return {
    version: EXTRACTOR_VERSION,
    supportsRoute: supportsFeedRoute,
    extract: extractPostContent,
    discover() {
      if (validRoute() && root) {
        suspended = false;
        if (liveRegion && !liveRegion.isConnected) root.append(liveRegion);
        addScan(root);
      }
    },
    routeChanged() {
      validRoute();
    },
    observe(nextRoot, nextCallbacks, signal) {
      stop();
      const currentObservation = ++observation;
      root = nextRoot;
      suspended = false;
      callbacks = nextCallbacks;
      route = url().href;
      const realm = root.ownerDocument.defaultView;
      if (
        signal.aborted ||
        !supportsFeedRoute(url()) ||
        !root.matches(SELECTORS.feed) ||
        !root.closest('main') ||
        !root.isConnected
      ) {
        callbacks.onHealthChanged(false);
        stop();
        return () => {};
      }
      const ports =
        options.observers ??
        (realm?.MutationObserver && realm?.IntersectionObserver
          ? {
              mutation: (callback: MutationCallback) =>
                new realm.MutationObserver(callback),
              intersection: (
                callback: IntersectionObserverCallback,
                init: IntersectionObserverInit,
              ) => new realm.IntersectionObserver(callback, init),
            }
          : null);
      if (!ports) {
        callbacks.onHealthChanged(false);
        stop();
        return () => {};
      }
      mutation = ports.mutation((records) => {
        if (suspended || !validRoute()) return;
        if (records.length > MAX_PENDING) {
          overflow();
          return;
        }
        for (const record of records) {
          if (owned(record.target)) continue;
          const target =
            record.target.nodeType === 1
              ? (record.target as Element)
              : record.target.parentElement;
          // Attribute changes made by our renderer carry no new extraction input.
          if (
            record.type === 'attributes' &&
            ['hidden', 'style', 'inert', 'aria-hidden'].includes(
              record.attributeName ?? '',
            ) &&
            states.get(target!)?.rendered
          )
            continue;
          if (record.type === 'childList') {
            if (
              record.addedNodes.length + record.removedNodes.length >
              MAX_PENDING
            ) {
              overflow();
              return;
            }
            for (const added of record.addedNodes)
              if (added.nodeType === 1 && !owned(added))
                addScan(added as Element);
          }
          const post = target?.closest(SELECTORS.post);
          if (post) enqueue(post);
          // Removal and identity-attribute loss must also refresh existing states.
          if (target && states.has(target)) enqueue(target);
        }
        requestBatch();
      });
      const height = Math.max(1, realm?.innerHeight ?? 800);
      intersection = ports.intersection(
        (entries) => {
          if (suspended || !validRoute()) return;
          if (entries.length > MAX_TRACKED) {
            overflow();
            return;
          }
          for (const entry of entries) {
            const node = placeholderPosts.get(entry.target) ?? entry.target;
            if (!candidates.has(node)) continue;
            const state = states.get(node);
            if ((state?.rendered?.placeholder ?? node) !== entry.target)
              continue;
            if (entry.isIntersecting) visibleCandidates.add(node);
            else visibleCandidates.delete(node);
            if (state) state.visible = entry.isIntersecting;
            if (entry.isIntersecting) {
              const current = refresh(node);
              if (current) emit(current);
            } else if (state) withdraw(state);
          }
        },
        { root: null, rootMargin: `${height}px 0px`, threshold: 0 },
      );
      mutation.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
      const onFocusOut = () => {
        if (focusTimers.size) return;
        const cancel = schedule(() => {
          focusTimers.delete(cancel);
          if (!validRoute()) return;
          for (const state of states.values())
            if (state.pending && state.identity && !focused(state))
              apply(state.identity, state.pending);
        }, 0);
        focusTimers.add(cancel);
      };
      const onRoute = () => {
        validRoute();
      };
      root.addEventListener('focusout', onFocusOut);
      realm?.addEventListener('popstate', onRoute);
      realm?.addEventListener('hashchange', onRoute);
      signal.addEventListener('abort', stop, { once: true });
      const observedRoot = root;
      releaseListeners = () => {
        observedRoot.removeEventListener('focusout', onFocusOut);
        realm?.removeEventListener('popstate', onRoute);
        realm?.removeEventListener('hashchange', onRoute);
        signal.removeEventListener('abort', stop);
      };
      const poll = () => {
        if (!validRoute()) return;
        if (!suspended) pruneCandidates();
        cancelPoll = schedule(poll, 500);
      };
      cancelPoll = schedule(poll, 500);
      liveRegion = root.ownerDocument.createElement('div');
      liveRegion.setAttribute('data-clearedin-owned', 'announcements');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.style.cssText =
        'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
      root.append(liveRegion);
      reportHealth(true);
      addScan(root);
      return () => {
        if (observation === currentObservation) stop();
      };
    },
    apply,
    reveal,
    restore(identity) {
      const state = find(identity);
      if (state) restore(state);
    },
    restoreAll() {
      // Retire identities as well as restoring: late pre-pause results cannot re-hide.
      suspended = true;
      cancelBatch?.();
      cancelBatch = null;
      pending.clear();
      scanRoots.length = 0;
      walker = null;
      if (liveRegion) {
        liveRegion.remove();
        liveRegion.textContent = '';
      }
      for (const state of states.values()) remove(state);
      for (const node of candidates) intersection?.unobserve(node);
      candidates.clear();
      visibleCandidates.clear();
    },
    dispose: stop,
  };
}
