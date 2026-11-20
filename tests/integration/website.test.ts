import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';
import { mountDemo } from '../../apps/website/src/demo';

describe('built website synthetic demo', () => {
  it('hides, protects, reveals, pauses and resets without any network request', async () => {
    const html = await readFile('apps/website/dist/demo/index.html', 'utf8');
    const { document, window } = parseHTML(html);
    const network = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network forbidden'));
    try {
      const pause = document.querySelector<HTMLButtonElement>('#pause')!;
      const reset = document.querySelector<HTMLButtonElement>('#reset')!;
      const rules = [
        ...document.querySelectorAll<HTMLSelectElement>('[data-category]'),
      ];
      expect(
        [pause, reset, ...rules].every((control) => control.disabled),
      ).toBe(true);
      // Moving a sample must preserve its own classification and rule text.
      const sponsored =
        document.querySelector<HTMLElement>('[data-sponsored]')!;
      sponsored.parentElement!.insertBefore(
        sponsored,
        document.querySelector('[data-fixture]'),
      );
      mountDemo(document);
      expect(
        [pause, reset, ...rules].every((control) => !control.disabled),
      ).toBe(true);
      expect(sponsored.querySelector('[data-reason]')!.textContent).toContain(
        'Sponsored posts',
      );
      expect(
        document.querySelector('[data-fixture="ambiguous"] [data-reason]')!
          .textContent,
      ).toContain('ambiguous');
      function select(category: string, value: string) {
        const node = document.querySelector<HTMLSelectElement>(
          `[data-category="${category}"]`,
        )!;
        for (const option of node.querySelectorAll('option'))
          option.removeAttribute('selected');
        node
          .querySelector(`option[value="${value}"]`)!
          .setAttribute('selected', '');
        node.dispatchEvent(new window.Event('change'));
      }
      for (const rule of rules) {
        const category = rule.dataset.category!;
        select(category, 'hide');
        const affected = document.querySelectorAll<HTMLElement>(
          '[data-body][hidden]',
        );
        expect(
          affected.length,
          `A sample should demonstrate ${category}`,
        ).toBeGreaterThan(0);
        expect(document.querySelector('#feed-jump')!.getAttribute('href')).toBe(
          `#${affected[0]!.parentElement!.id}`,
        );
        select(category, 'always_show');
        for (const body of affected) {
          expect(body.hidden).toBe(false);
          expect(
            body.parentElement!.querySelector('[data-reason]')!.textContent,
          ).toContain('Always show');
        }
        select(category, 'show');
      }
      const bait = document.querySelector('[data-fixture="engagement-bait"]')!;
      const body = bait.querySelector<HTMLElement>('[data-body]')!;
      select('sponsored', 'hide');
      expect(sponsored.querySelector<HTMLElement>('[data-body]')!.hidden).toBe(
        true,
      );
      select('engagement_bait', 'hide');
      expect(body.hidden).toBe(true);
      bait.querySelector<HTMLButtonElement>('button')!.click();
      expect(body.hidden).toBe(false);
      select('product_launch', 'hide');
      const launch = document.querySelector(
        '[data-fixture="technical-launch"] [data-body]',
      ) as HTMLElement;
      expect(launch.hidden).toBe(true);
      select('technical_content', 'always_show');
      expect(launch.hidden).toBe(false);
      select('motivational_story', 'hide');
      pause.click();
      expect(pause.textContent).toBe('Resume demo');
      expect(
        [...document.querySelectorAll<HTMLElement>('[data-body]')].every(
          (node) => !node.hidden,
        ),
      ).toBe(true);
      pause.click();
      expect(sponsored.querySelector<HTMLElement>('[data-body]')!.hidden).toBe(
        true,
      );
      reset.click();
      expect(rules.every((rule) => rule.value === 'show')).toBe(true);
      expect(pause.textContent).toBe('Pause demo');
      expect(document.querySelector('#demo-status')!.textContent).toContain(
        '0 of 14',
      );
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
});
