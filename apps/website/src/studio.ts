import type { CategoryMode } from '@clearedin/contracts';
import type { DemoPolicy } from './demo-policy';

const jobHunt: Record<string, CategoryMode> = {
  job_posting: 'always_show',
  engagement_bait: 'hide',
  promotion: 'hide',
};

export function mountStudio(document: Document) {
  const rules = new Map(
    [...document.querySelectorAll<HTMLSelectElement>('.quick select')].map(
      (select) => [select.id.slice('quick-'.length), select],
    ),
  );
  const quick = document.querySelector<HTMLDetailsElement>('.quick')!;
  const preset = document.querySelector<HTMLButtonElement>('#job-hunt')!;
  const reset = document.querySelector<HTMLButtonElement>('#show-all')!;
  const status = document.querySelector<HTMLElement>(
    '.feed-line [role="status"]',
  )!;
  const revealed = new Set<HTMLElement>();
  const posts = [
    ...document.querySelectorAll<HTMLElement>('.post[data-policy]'),
  ].map((post) => ({
    post,
    policy: JSON.parse(post.dataset.policy!) as DemoPolicy,
    rule: rules.get(post.dataset.category!)!,
    content: post.querySelector<HTMLElement>('.post-content')!,
    collapsed: post.querySelector<HTMLElement>('.hidden-row')!,
    reason: post.querySelector<HTMLElement>('[data-reason]')!,
    state: post.querySelector<HTMLElement>('.state')!,
    action: post.querySelector<HTMLButtonElement>('[data-mode]')!,
    reveal: post.querySelector<HTMLButtonElement>('[data-reveal]')!,
  }));

  function render() {
    let hidden = 0;
    for (const {
      post,
      policy,
      rule,
      content,
      collapsed,
      reason,
      state,
      action,
    } of posts) {
      const key = policy.categories
        .map((id) => rules.get(id)?.value ?? 'show')
        .join('/');
      const outcome = revealed.has(post)
        ? policy.revealed
        : policy.outcomes[key]!;
      content.hidden = outcome.hidden;
      collapsed.hidden = !outcome.hidden;
      post.classList.toggle('collapsed', outcome.hidden);
      reason.textContent = outcome.message;
      if (outcome.hidden) hidden++;
      state.textContent = revealed.has(post)
        ? 'Revealed'
        : rule.value === 'always_show'
          ? 'Always show'
          : '';
      state.hidden = !state.textContent;
      if (action.dataset.mode === 'always_show')
        action.querySelector('span')!.textContent =
          rule.value === 'always_show'
            ? 'Remove protection'
            : 'Always show this category';
    }
    status.textContent = `${posts.length - hidden} visible · ${hidden} hidden`;
    const entries = [...rules];
    preset.setAttribute(
      'aria-pressed',
      String(
        entries.every(([id, rule]) => rule.value === (jobHunt[id] ?? 'show')),
      ),
    );
    reset.setAttribute(
      'aria-pressed',
      String(entries.every(([, rule]) => rule.value === 'show')),
    );
  }

  function applyPreset(modes: Record<string, CategoryMode>) {
    revealed.clear();
    for (const [id, rule] of rules) rule.value = modes[id] ?? 'show';
    render();
  }
  preset.onclick = () => applyPreset(jobHunt);
  reset.onclick = () => applyPreset({});
  for (const rule of rules.values()) rule.onchange = render;
  for (const { post, rule, action, reveal } of posts) {
    action.onclick = () => {
      revealed.delete(post);
      rule.value =
        action.dataset.mode === 'always_show' && rule.value === 'always_show'
          ? 'show'
          : action.dataset.mode!;
      render();
      post.focus();
    };
    reveal.onclick = () => {
      revealed.add(post);
      render();
      post.focus();
    };
  }
  if (window.matchMedia('(max-width: 700px)').matches)
    quick.open = location.hash.startsWith('#quick-');
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    'a[href^="#quick-"]',
  ))
    link.addEventListener('click', () => {
      quick.open = true;
    });
  applyPreset({});
  for (const control of document.querySelectorAll<
    HTMLButtonElement | HTMLSelectElement
  >('.studio :disabled'))
    control.disabled = false;
}
