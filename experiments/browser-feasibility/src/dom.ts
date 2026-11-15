export interface Check {
  name: string;
  passed: boolean;
}
interface Identity {
  id: string;
  text: string;
  generation: number;
}
interface State {
  identity: Identity;
  body: HTMLElement;
  hidden: string | null;
  placeholder: HTMLButtonElement | null;
  revealed: boolean;
}

// Only synthetic selectors. This is a mechanics probe, not the task 05 adapter.
export function createDomProbe(root: HTMLElement) {
  const states = new Map<HTMLElement, State>();
  let generation = 0;
  function restore(state: State) {
    if (state.hidden === null) state.body.removeAttribute('hidden');
    else state.body.setAttribute('hidden', state.hidden);
    state.placeholder?.remove();
    state.placeholder = null;
  }
  function discover(node: HTMLElement): Identity | null {
    const previous = states.get(node);
    const id = node.dataset.syntheticPost;
    const body = node.querySelector<HTMLElement>('[data-body]');
    if (!id || !body) {
      if (previous) restore(previous);
      states.delete(node);
      return null;
    }
    const text = body.textContent ?? '';
    if (
      previous?.identity.id === id &&
      previous.identity.text === text &&
      previous.body === body
    )
      return { ...previous.identity };
    if (previous) restore(previous);
    const identity = { id, text, generation: ++generation };
    states.set(node, {
      identity,
      body,
      hidden: body.getAttribute('hidden'),
      placeholder: null,
      revealed: false,
    });
    return { ...identity };
  }
  return {
    discover,
    collapse(node: HTMLElement, identity: Identity): boolean {
      const current = discover(node);
      const state = states.get(node);
      if (
        !state ||
        !current ||
        state.revealed ||
        state.hidden !== null ||
        current.id !== identity.id ||
        current.text !== identity.text ||
        current.generation !== identity.generation
      )
        return false;
      if (state.placeholder) return true;
      state.body.hidden = true;
      const button = root.ownerDocument.createElement('button');
      button.textContent = 'Reveal synthetic post';
      button.type = 'button';
      button.addEventListener('click', () => {
        restore(state);
        state.revealed = true;
      });
      state.body.after(button);
      state.placeholder = button;
      return true;
    },
    restoreAll() {
      for (const state of states.values()) restore(state);
      states.clear();
    },
  };
}

export function runDomChecks(root: HTMLElement): Check[] {
  const checks: Check[] = [];
  const check = (name: string, passed: boolean) =>
    checks.push({ name, passed });
  const node = root.querySelector<HTMLElement>('[data-synthetic-post]');
  const body = node?.querySelector<HTMLElement>('[data-body]');
  if (!node || !body)
    return [{ name: 'synthetic fixture present', passed: false }];
  const original = root.innerHTML;
  const originalId = node.dataset.syntheticPost;
  const originalText = body.textContent;
  const probe = createDomProbe(root);
  const first = probe.discover(node);
  check('discover', first !== null);
  if (!first) return checks;
  check('collapse', probe.collapse(node, first) && body.hidden);
  node.querySelector<HTMLButtonElement>('button')?.click();
  check('reveal', !body.hidden && !node.querySelector('button'));
  check(
    'late result cannot rehide revealed post',
    !probe.collapse(node, first),
  );
  probe.restoreAll();
  const second = probe.discover(node)!;
  probe.collapse(node, second);
  node.dataset.syntheticPost = 'reused';
  body.textContent = 'Another synthetic post';
  const reused = probe.discover(node)!;
  check(
    'recycled node restored and generation changed',
    !body.hidden && reused.generation !== second.generation,
  );
  check('stale generation rejected', !probe.collapse(node, second));
  probe.collapse(node, reused);
  probe.restoreAll();
  check(
    'teardown restores content',
    !body.hidden && !node.querySelector('button'),
  );
  node.dataset.syntheticPost = originalId;
  body.textContent = originalText;
  check('exact markup restored', root.innerHTML === original);
  return checks;
}
