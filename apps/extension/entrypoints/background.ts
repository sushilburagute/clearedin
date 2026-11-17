import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { createBroker } from '../src/background/broker';

export default defineBackground(() => {
  const broker = createBroker({
    extension: {
      id: browser.runtime.id,
      optionsUrl: browser.runtime.getURL('/options.html'),
      popupUrl: browser.runtime.getURL('/popup.html'),
      version: browser.runtime.getManifest().version,
    },
    clock: {
      now: () => Date.now(),
      schedule(callback, delay) {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
    },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browser: {
      capabilities: {
        family: import.meta.env.BROWSER === 'firefox' ? 'firefox' : 'chrome',
        trustedSessionStorage: false,
        sessionSurvivesBackgroundRestart: false,
      },
      localStorage: {
        async get(key) {
          return (await browser.storage.local.get(key))[key];
        },
        async set(key, value) {
          await browser.storage.local.set({ [key]: value });
        },
        async remove(key) {
          await browser.storage.local.remove(key);
        },
        async clear() {
          await browser.storage.local.clear();
        },
      },
      trustedSessionStorage: null,
      async hasProviderPermission() {
        return false;
      },
      async requestProviderPermission() {
        return false;
      },
      async broadcast(event) {
        await browser.runtime.sendMessage(event).catch(() => undefined);
      },
    },
  });
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    // Broadcasts are one-way notifications, not broker requests.
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      (message.type === 'STATUS_CHANGED' || message.type === 'RESTORE_ALL')
    )
      return undefined;
    return broker.handle(message, {
      extensionId: sender.id ?? '',
      url: sender.url ?? '',
      tabId: sender.tab?.id ?? null,
      frameId: sender.frameId ?? null,
    });
  });
});
