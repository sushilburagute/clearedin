import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { createStorage } from '@clearedin/storage';
import { createBroker } from '../src/background/broker';
import type { BroadcastMessage } from '@clearedin/contracts';

export default defineBackground(() => {
  const broadcast = async (event: BroadcastMessage) => {
    const tabs = await browser.tabs.query({
      url: 'https://www.linkedin.com/feed/*',
    });
    await Promise.allSettled(
      tabs
        .filter((tab) => tab.id !== undefined)
        .map((tab) => browser.tabs.sendMessage(tab.id!, event)),
    );
  };
  const storage = createStorage({
    clock: { now: Date.now },
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
      hasProviderPermission: async () => false,
      requestProviderPermission: async () => false,
      broadcast,
    },
  });
  const broker = createBroker(
    storage,
    browser.runtime.id,
    browser.runtime.getURL('/'),
    broadcast,
  );
  browser.runtime.onMessage.addListener((raw, sender) =>
    broker(raw, {
      extensionId: sender.id ?? '',
      url: sender.url ?? '',
      tabId: sender.tab?.id ?? null,
      frameId: sender.frameId ?? null,
    }),
  );
});
