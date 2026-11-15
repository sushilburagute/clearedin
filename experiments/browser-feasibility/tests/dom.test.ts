import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { createDomProbe, runDomChecks } from '../src/dom.ts';

// Already pinned as a WXT dependency; no new package or lockfile mutation.
const wxtRequire = createRequire(import.meta.resolve('wxt'));
const { parseHTML } = wxtRequire('linkedom');
function fixture() {
  const { document } = parseHTML(
    '<html><body><main><article data-synthetic-post="one"><div data-body>Synthetic</div></article></main></body></html>',
  );
  return document.querySelector('main') as HTMLElement;
}
it('discovers, collapses, reveals, rejects stale reuse, and restores exact markup', () => {
  const checks = runDomChecks(fixture());
  expect(checks.length).toBe(8);
  expect(checks.filter((check) => !check.passed)).toEqual([]);
});
it('keeps original nodes and listeners, and rejects changed body text', () => {
  const root = fixture();
  const node = root.querySelector<HTMLElement>('article')!;
  const body = node.firstElementChild as HTMLElement;
  let clicks = 0;
  body.addEventListener('click', () => {
    clicks++;
  });
  const probe = createDomProbe(root);
  const identity = probe.discover(node)!;
  probe.collapse(node, identity);
  body.textContent = 'Expanded text';
  expect(probe.collapse(node, identity)).toBe(false);
  expect(body.hidden).toBe(false);
  probe.restoreAll();
  expect(node.firstElementChild).toBe(body);
  body.click();
  expect(clicks).toBe(1);
});
it('preserves preexisting hidden attributes and fails open on ambiguous fixtures', () => {
  const root = fixture();
  const node = root.querySelector<HTMLElement>('article')!;
  const body = node.firstElementChild as HTMLElement;
  body.setAttribute('hidden', 'until-found');
  const probe = createDomProbe(root);
  expect(probe.collapse(node, probe.discover(node)!)).toBe(false);
  probe.restoreAll();
  expect(body.getAttribute('hidden')).toBe('until-found');
  node.removeAttribute('data-synthetic-post');
  expect(probe.discover(node)).toBeNull();
});
it('restores collapsed content when node identity disappears', () => {
  const root = fixture();
  const node = root.querySelector<HTMLElement>('article')!;
  const body = node.firstElementChild as HTMLElement;
  const probe = createDomProbe(root);
  probe.collapse(node, probe.discover(node)!);
  node.removeAttribute('data-synthetic-post');
  expect(probe.discover(node)).toBeNull();
  expect(body.hidden).toBe(false);
  expect(node.querySelector('button')).toBeNull();
});
