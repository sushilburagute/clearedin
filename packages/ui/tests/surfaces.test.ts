import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OptionsClient, OptionsRequest } from '@clearedin/contracts';
import {
  createDemoSession,
  createOptionsController,
  createPopupController,
  createUnavailableClient,
  OptionsSurface,
  PopupSurface,
  UNAVAILABLE_ENVIRONMENT,
} from '../src';

let root: Root;
let document: Document;
let window: Window & typeof globalThis;
let restoreForm: () => void;
beforeEach(() => {
  const dom = parseHTML('<html><body><div id="root"></div></body></html>');
  document = dom.document as unknown as Document;
  window = dom.window as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // linkedom omits native form reset; use its password-input behavior in these tests.
  const formPrototype = Object.getPrototypeOf(
    document.createElement('form'),
  ) as object;
  const oldReset = Object.getOwnPropertyDescriptor(formPrototype, 'reset');
  Object.defineProperty(formPrototype, 'reset', {
    configurable: true,
    writable: true,
    value(this: HTMLFormElement) {
      for (const input of this.querySelectorAll<HTMLInputElement>(
        'input[name="credential"]',
      ))
        input.value = '';
    },
  });
  restoreForm = () => {
    if (oldReset) Object.defineProperty(formPrototype, 'reset', oldReset);
    else Reflect.deleteProperty(formPrototype, 'reset');
  };
  root = createRoot(document.getElementById('root')!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  restoreForm();
  vi.unstubAllGlobals();
});

function button(label: string): HTMLButtonElement {
  const result = Array.from(document.querySelectorAll('button')).find(
    (node) => node.textContent === label,
  );
  if (!result) throw new Error(`Missing synthetic test button: ${label}`);
  return result;
}
async function click(label: string) {
  await act(async () => button(label).click());
}

describe('rendered extension surfaces (synthetic DOM)', () => {
  it('labels all category controls, masks credentials, and requires an explicit consent checkbox', async () => {
    const session = createDemoSession();
    const controller = createOptionsController(
      session.client,
      session.environment,
    );
    await act(async () =>
      root.render(createElement(OptionsSurface, { controller })),
    );
    expect(
      document.querySelector('[aria-label="Synthetic demo"]')?.textContent,
    ).toContain('Never enter a real key');
    const categories = document.querySelectorAll('.ci-category select');
    expect(categories).toHaveLength(12);
    for (const select of categories) {
      expect(select.getAttribute('aria-describedby')).toBeTruthy();
      expect(
        document.querySelector(`label[for="${select.id}"]`)?.textContent,
      ).toBeTruthy();
      expect(select.querySelector('option')?.getAttribute('value')).toBe(
        'show',
      );
    }
    const credential = document.querySelector<HTMLInputElement>(
      '[name="credential"]',
    )!;
    expect(credential.type).toBe('password');
    expect(credential.disabled).toBe(true);
    expect(credential.getAttribute('value') ?? '').toBe('');
    expect(button('Record consent').disabled).toBe(true);
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(
      document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .checked,
    ).not.toBe(true);
  });

  it('offers native labeled provider/model forms and a separate permission gesture', async () => {
    const session = createDemoSession();
    const requests: OptionsRequest[] = [];
    const client: OptionsClient = {
      ...session.client,
      async send(request) {
        requests.push(request);
        return session.client.send(request);
      },
    };
    const controller = createOptionsController(client, session.environment);
    await act(async () =>
      root.render(createElement(OptionsSurface, { controller })),
    );
    const select = document.querySelector<HTMLSelectElement>('select')!;
    // linkedom has a getter-only select.value; supply the native event's selected value.
    Object.defineProperty(select, 'value', {
      configurable: true,
      value: 'openai',
    });
    await act(async () =>
      select.dispatchEvent(new window.Event('change', { bubbles: true })),
    );
    expect(button('Save provider and model').disabled).toBe(false);
    const providerForm = select.closest('form')!;
    await act(async () =>
      providerForm.dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true }),
      ),
    );
    expect(requests).toContainEqual(
      expect.objectContaining({
        type: 'SET_PROVIDER',
        provider: 'openai',
        model: 'SYNTHETIC-UI-ONLY',
      }),
    );
    expect(controller.getSnapshot().permission).toBe(false);
    await click('Grant provider host access');
    expect(controller.getSnapshot().permission).toBe(true);
    await click('Run synthetic connection test');
    expect(document.body.textContent).toContain(
      'UI simulation passed; no live connection tested.',
    );
    expect(button('Record consent').disabled).toBe(true);
    expect(requests.some((request) => request.type === 'SET_CONSENT')).toBe(
      false,
    );
  });

  it('clears a masked credential before dispatch and never renders echoed transport errors', async () => {
    const session = createDemoSession();
    await session.client.send({
      protocolVersion: 1,
      requestId: 'setup',
      type: 'SET_PROVIDER',
      provider: 'openai',
      model: 'SYNTHETIC-UI-ONLY',
    });
    await session.environment.requestPermission('openai');
    let sent = false;
    const client: OptionsClient = {
      ...session.client,
      async send(request) {
        if (request.type === 'SET_CREDENTIAL') {
          sent = true;
          expect(credential.value).toBe('');
          expect(request.credential).toBe('SYNTHETIC-TEST-SECRET');
          throw new Error(`Untrusted error echoes ${request.credential}`);
        }
        return session.client.send(request);
      },
    };
    const controller = createOptionsController(client, {
      ...session.environment,
      mode: 'connected',
      credentialEntry: true,
    });
    await act(async () =>
      root.render(createElement(OptionsSurface, { controller })),
    );
    const credential = document.querySelector<HTMLInputElement>(
      '[name="credential"]',
    )!;
    expect(credential.disabled).toBe(false);
    const form = credential.closest('form')!;
    // These native form APIs are absent from linkedom; model only their browser behavior.
    Object.defineProperty(form, 'elements', {
      value: { namedItem: () => credential },
    });
    form.reset = () => {
      credential.value = '';
    };
    credential.value = 'SYNTHETIC-TEST-SECRET';
    await act(async () =>
      form.dispatchEvent(
        new window.Event('submit', { bubbles: true, cancelable: true }),
      ),
    );
    expect(sent).toBe(true);
    expect(document.body.textContent).not.toContain('SYNTHETIC-TEST-SECRET');
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(
      'SYNTHETIC-TEST-SECRET',
    );
    expect(credential.value).toBe('');
    expect(credential.getAttribute('value') ?? '').toBe('');
  });

  it('keeps the unavailable popup honest and opens settings without offering credentials', async () => {
    const openSettings = vi.fn();
    const controller = createPopupController(createUnavailableClient());
    await act(async () =>
      root.render(
        createElement(PopupSurface, {
          controller,
          openSettings,
          mode: 'unavailable',
        }),
      ),
    );
    expect(document.body.textContent).toContain(
      'live filtering and provider connections are unavailable',
    );
    expect(document.querySelector('input')).toBeNull();
    await click('Open settings');
    expect(openSettings).toHaveBeenCalledOnce();
  });

  it('keeps provider and credential actions unavailable in the packaged default configuration', async () => {
    const controller = createOptionsController(
      createUnavailableClient(),
      UNAVAILABLE_ENVIRONMENT,
    );
    await act(async () =>
      root.render(createElement(OptionsSurface, { controller })),
    );
    expect(button('Save provider and model').disabled).toBe(true);
    expect(button('Grant provider host access').disabled).toBe(true);
    expect(button('Save session credential').disabled).toBe(true);
    expect(document.body.textContent).toContain(
      'Provider connections and live filtering are unavailable.',
    );
  });
});
