import { CATEGORY_DEFINITION_BY_ID } from '@clearedin/taxonomy';
import type { CategoryId } from '@clearedin/contracts';

export interface RenderedPost {
  restore(): void;
  placeholder: HTMLElement;
}

/** Never detach or replace host-owned children. Snapshot exactly the attributes we change. */
export function collapsePost(
  post: HTMLElement,
  categories: readonly CategoryId[],
  onReveal: () => void,
): RenderedPost {
  const attributes = ['hidden', 'style', 'inert', 'aria-hidden'] as const;
  const original = attributes.map(
    (name) => [name, post.getAttribute(name)] as const,
  );
  const document = post.ownerDocument;
  const placeholder = document.createElement('div');
  placeholder.setAttribute('data-clearedin-owned', 'placeholder');
  const shadow = placeholder.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    ':host{display:block;margin:8px 0;font:14px/1.5 system-ui,sans-serif;color:#17212b;background:#fff;border:1px solid #52606d;border-radius:8px}section{padding:12px}button,summary{font:inherit;cursor:pointer;min-height:44px}button{color:#fff;background:#0f766e;border:0;border-radius:8px;padding:8px 16px;margin:0 8px}button:focus-visible,summary:focus-visible{outline:3px solid #0f766e;outline-offset:3px}details{margin-top:8px}p{margin:8px 0}';
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Hidden post');
  const label = document.createElement('span');
  const labels = categories.map((id) => CATEGORY_DEFINITION_BY_ID[id].label);
  label.textContent = `Hidden: ${labels[0] ?? 'Selected category'}`;
  const show = document.createElement('button');
  show.type = 'button';
  show.textContent = 'Show';
  show.setAttribute(
    'aria-label',
    'Show hidden post and keep it visible for this page session',
  );
  show.addEventListener('click', onReveal);
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Why this post is hidden';
  const explanation = document.createElement('p');
  explanation.textContent = `Your Hide rules matched: ${labels.join(', ')}. Classification can be wrong. Showing this post keeps it visible for this page session; it does not change your category rules or train a model. Provider and model are shown in extension settings.`;
  details.append(summary, explanation);
  section.append(label, show, details);
  shadow.append(style, section);
  post.before(placeholder);
  post.setAttribute('hidden', '');
  post.setAttribute('inert', '');
  post.setAttribute('aria-hidden', 'true');
  post.style.setProperty('display', 'none', 'important');
  return {
    placeholder,
    restore() {
      show.removeEventListener('click', onReveal);
      placeholder.remove();
      for (const [name, value] of original) {
        if (value === null) post.removeAttribute(name);
        else post.setAttribute(name, value);
      }
    },
  };
}
