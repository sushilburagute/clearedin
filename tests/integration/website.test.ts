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
      await mountDemo(document);
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
      const bait = document.querySelector('[data-fixture="engagement-bait"]')!;
      const body = bait.querySelector<HTMLElement>('[data-body]')!;
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
      document.querySelector<HTMLButtonElement>('#pause')!.click();
      expect(
        [...document.querySelectorAll<HTMLElement>('[data-body]')].every(
          (node) => !node.hidden,
        ),
      ).toBe(true);
      document.querySelector<HTMLButtonElement>('#reset')!.click();
      expect(document.querySelector('#demo-status')!.textContent).toContain(
        '0 of 11',
      );
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
});
