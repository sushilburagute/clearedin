import { CATEGORY_DEFINITION_BY_ID } from '@clearedin/taxonomy';
import type { CategoryId } from '@clearedin/contracts';

export interface RenderedPost {
  restore(): void;
  updateCategories(categories: readonly CategoryId[]): void;
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
  style.textContent = `
    :host {
      --surface: #fff; --text: #17212b; --muted: #52606d;
      --accent: #0f766e; --button-text: #fff; --border: #7b8794;
      display: block; margin: 8px 0; font: 14px/1.5 "Segoe UI", system-ui, sans-serif;
      color: var(--text); background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; color-scheme: light dark;
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --surface: #202c36; --text: #f2f5f7; --muted: #b9c5cf;
        --accent: #6ee7d2; --button-text: #102821; --border: #8d9ba8;
      }
    }
    section { padding: 8px 16px; }
    header { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
    header span { flex: 1 1 auto; overflow-wrap: anywhere; font-weight: 600; }
    button, summary { box-sizing: border-box; min-height: 44px; font: inherit; cursor: pointer; }
    button { padding: 8px 16px; border: 1px solid transparent; border-radius: 8px; color: var(--button-text); background: var(--accent); }
    summary { width: fit-content; max-width: 100%; padding: 10px 0; color: var(--muted); }
    button:focus-visible, summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    p { margin: 0 0 8px; max-width: 65ch; }
  `;
  const section = document.createElement('section');
  section.setAttribute('aria-label', 'Hidden post');
  const label = document.createElement('span');
  const header = document.createElement('header');
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
  function updateCategories(matches: readonly CategoryId[]) {
    const labels = matches.map((id) => CATEGORY_DEFINITION_BY_ID[id].label);
    label.textContent = `Hidden: ${labels[0] ?? 'Selected category'}`;
    explanation.textContent = `This post matched your Hide rules for ${labels.join(', ')}. Show keeps it visible for this page session. You can change your rules or check your provider and model in extension settings.`;
  }
  updateCategories(categories);
  details.append(summary, explanation);
  header.append(label, show);
  section.append(header, details);
  shadow.append(style, section);
  post.before(placeholder);
  post.setAttribute('hidden', '');
  post.setAttribute('inert', '');
  post.setAttribute('aria-hidden', 'true');
  post.style.setProperty('display', 'none', 'important');
  return {
    placeholder,
    updateCategories,
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
