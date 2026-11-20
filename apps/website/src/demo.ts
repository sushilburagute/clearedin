import type { DemoPolicy } from './demo-policy';

export function mountDemo(document: Document) {
  const selects = [
    ...document.querySelectorAll<HTMLSelectElement>('[data-category]'),
  ];
  const controls = new Map(
    selects.map((select) => [select.dataset.category!, select]),
  );
  const posts = [...document.querySelectorAll<HTMLElement>('.demo-post')].map(
    (post) => ({
      post,
      policy: JSON.parse(post.dataset.policy!) as DemoPolicy,
      body: post.querySelector<HTMLElement>('[data-body]')!,
      button: post.querySelector<HTMLButtonElement>('[data-reveal]')!,
      reason: post.querySelector<HTMLElement>('[data-reason]')!,
    }),
  );
  const pause = document.querySelector<HTMLButtonElement>('#pause')!;
  const reset = document.querySelector<HTMLButtonElement>('#reset')!;
  const status = document.querySelector<HTMLElement>('#demo-status')!;
  const feedJump = document.querySelector<HTMLAnchorElement>('#feed-jump')!;
  const revealed = new Set<Element>();
  let paused = false;

  function render() {
    let hidden = 0;
    let firstHidden: HTMLElement | undefined;
    for (const { post, policy, body, button, reason } of posts) {
      const key = policy.categories
        .map((id) => controls.get(id)!.value)
        .join('/');
      const decision = paused
        ? policy.paused
        : revealed.has(post)
          ? policy.revealed
          : policy.outcomes[key]!;
      body.hidden = decision.hidden;
      button.hidden = !decision.hidden;
      reason.textContent = decision.message;
      if (decision.hidden) {
        hidden++;
        firstHidden ??= post;
      }
    }
    pause.textContent = paused ? 'Resume demo' : 'Pause demo';
    status.textContent = paused
      ? 'Paused. All posts are visible.'
      : `${hidden} of ${posts.length} posts hidden.`;
    feedJump.href = firstHidden ? `#${firstHidden.id}` : '#demo-feed';
    feedJump.textContent = firstHidden ? 'First hidden post' : 'Sample feed';
  }

  function resetDemo() {
    revealed.clear();
    paused = false;
    for (const select of selects) {
      select.querySelector<HTMLOptionElement>(
        'option[value="show"]',
      )!.selected = true;
    }
    render();
  }

  for (const select of selects) select.addEventListener('change', render);
  for (const { post, button } of posts) {
    button.addEventListener('click', () => {
      revealed.add(post);
      render();
      post.focus();
    });
  }
  pause.addEventListener('click', () => {
    paused = !paused;
    render();
  });
  reset.addEventListener('click', resetDemo);
  resetDemo();
  for (const control of [pause, reset, ...selects]) control.disabled = false;
}
