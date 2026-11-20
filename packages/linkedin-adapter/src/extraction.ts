import { MAX_POST_CHARACTERS } from '@clearedin/contracts';
import type { ExtractionCompleteness } from '@clearedin/contracts';

/** Packaged, conservative selector assumptions; live LinkedIn compatibility is unverified. */
export const SELECTORS = {
  feed: '[role="feed"], .scaffold-finite-scroll__content',
  post: '.feed-shared-update-v2',
  body: '.update-components-text, .feed-shared-update-v2__description',
  quote: '.feed-shared-update-v2__reshared-content',
  preview: '.feed-shared-article__title',
  sponsored:
    '.feed-shared-actor__sub-description, .update-components-actor__sub-description',
  excluded:
    '[data-clearedin-owned], .comments-comments-list, .comments-comment-item, .social-details-social-counts, .feed-shared-actor, .update-components-actor, .msg-overlay-list-bubble, script, style, template, button, input, textarea, select, [contenteditable="true"]',
} as const;

export interface ExtractedContent {
  text: string;
  extraction: ExtractionCompleteness;
  localSponsored: boolean;
  /** Local digest material only; never sent as provider input. */
  digestInput: string;
  repostContext: 'none' | 'visible_quote';
}

export function supportsFeedRoute(url: URL): boolean {
  return (
    url.origin === 'https://www.linkedin.com' &&
    (url.pathname === '/feed' || url.pathname.startsWith('/feed/')) &&
    !url.username &&
    !url.password
  );
}

function belongsTo(node: Element, post: Element): boolean {
  if (node.closest(SELECTORS.post) !== post) return false;
  let current: Element | null = node;
  while (current && current !== post) {
    if (current.matches(SELECTORS.excluded)) return false;
    current = current.parentElement;
  }
  return true;
}

function visible(element: Element, boundary: Element): boolean {
  let current: Element | null = element;
  while (current && current !== boundary) {
    if (
      current.hasAttribute('hidden') ||
      current.getAttribute('aria-hidden') === 'true' ||
      current.hasAttribute('inert')
    )
      return false;
    const style =
      current.ownerDocument.defaultView?.getComputedStyle?.(current);
    if (
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      style?.visibility === 'collapse'
    )
      return false;
    const inline = (current as HTMLElement).style;
    if (
      inline?.display === 'none' ||
      inline?.visibility === 'hidden' ||
      inline?.visibility === 'collapse'
    )
      return false;
    current = current.parentElement;
  }
  return true;
}

/** Walk only selected text regions, never a whole post's textContent. */
function readText(region: Element, post: Element): string | null {
  let visited = 0;
  let length = 0;
  const parts: string[] = [];
  const stack: Node[] = [region];
  while (stack.length) {
    const node = stack.pop()!;
    if (++visited > 2_000 || length > MAX_POST_CHARACTERS * 2) return null;
    if (node.nodeType === 3) {
      const value = node.textContent ?? '';
      length += value.length;
      parts.push(value);
      continue;
    }
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    // The region was selected within this post. A pruned ancestor's children
    // never enter the stack, so descendant visibility only needs a local check.
    if (element === region) {
      if (!visible(region, post)) continue;
    } else if (
      element.matches(`${SELECTORS.post}, ${SELECTORS.excluded}`) ||
      !visible(element, element.parentElement!)
    )
      continue;
    if (element.tagName === 'BR') parts.push('\n');
    if (/^(P|DIV|LI|H[1-6])$/.test(element.tagName)) parts.push('\n');
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
      const child = element.childNodes[i];
      if (child) stack.push(child);
    }
  }
  return parts
    .join('')
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ownedMatches(post: Element, selector: string): Element[] {
  return Array.from(post.querySelectorAll(selector)).filter((node) =>
    belongsTo(node, post),
  );
}

function isSponsoredDisclosure(marker: Element): boolean {
  if (!/^(Sponsored|Promoted)$/.test(marker.textContent?.trim() ?? ''))
    return false;
  const textNodes = marker.ownerDocument.createTreeWalker(marker, 4);
  let node;
  while ((node = textNodes.nextNode())) {
    if (node.textContent?.trim() && !visible(node.parentElement!, marker))
      return false;
  }
  return true;
}

export function extractPostContent(post: Element): ExtractedContent | null {
  if (!post.matches(SELECTORS.post)) return null;
  // Bound later selector queries and text walks even on adversarial oversized post trees.
  const walker = post.ownerDocument.createTreeWalker(post, 1);
  let count = 0;
  while (walker.nextNode()) if (++count > 2_000) return null;
  const quotes = ownedMatches(post, SELECTORS.quote);
  if (quotes.length > 1) return null;
  const quote = quotes[0];
  const bodies = ownedMatches(post, SELECTORS.body);
  const primary = bodies.filter((node) => !quote?.contains(node));
  const quoted = bodies.filter((node) => quote?.contains(node));
  if (primary.length > 1 || quoted.length > 1) return null;
  const previews = ownedMatches(post, SELECTORS.preview);
  if (previews.length > 1) return null;
  const regions = [...primary, ...quoted, ...previews];
  const texts: string[] = [];
  let complete = true;
  for (const region of regions) {
    const text = readText(region, post);
    if (text === null) return null;
    if (text) texts.push(text);
    if (!text || /(?:\u2026|\.\.\.)$/.test(text)) complete = false;
  }
  const full = texts.join('\n\n');
  if (full.length > MAX_POST_CHARACTERS || !full || !bodies.length)
    complete = false;
  if (
    Array.from(
      post.querySelectorAll(
        '[aria-expanded="false"], .feed-shared-inline-show-more-text--collapsed',
      ),
    )
      .filter(
        (node) =>
          node.closest(SELECTORS.post) === post &&
          !node.closest(
            '.comments-comment-item, .comments-comments-list, .feed-shared-actor, .update-components-actor',
          ),
      )
      .some(
        (node) =>
          visible(node, post) &&
          (node.matches(
            '.feed-shared-inline-show-more-text--collapsed, .feed-shared-inline-show-more-text__see-more-less-toggle',
          ) ||
            (node.matches('button') &&
              !node.matches('[aria-haspopup="menu"], [aria-haspopup="true"]'))),
      )
  )
    complete = false;
  if (quote && (!quoted.length || !visible(quote, post))) complete = false;
  const markers = Array.from(post.querySelectorAll(SELECTORS.sponsored)).filter(
    (node) =>
      node.closest(SELECTORS.post) === post &&
      !node.closest('.comments-comment-item, .comments-comments-list') &&
      !quote?.contains(node) &&
      visible(node, post),
  );
  const localSponsored =
    markers.length === 1 && isSponsoredDisclosure(markers[0]!);
  const text = full.slice(0, MAX_POST_CHARACTERS);
  const extraction = complete ? 'complete' : 'partial';
  const repostContext = quote ? 'visible_quote' : 'none';
  return {
    text,
    extraction,
    localSponsored,
    repostContext,
    digestInput: JSON.stringify([
      text,
      extraction,
      localSponsored,
      repostContext,
    ]),
  };
}

export function localSourceId(post: Element): string | null {
  const urn = post.getAttribute('data-urn') ?? post.getAttribute('data-id');
  return urn && /^urn:li:(activity|share|ugcPost):[0-9]{1,30}$/.test(urn)
    ? urn
    : null;
}
