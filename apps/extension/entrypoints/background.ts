import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { PROVIDER_IDS, type BroadcastMessage } from '@clearedin/contracts';
import {
  createProviderAdapter,
  PROVIDER_REGISTRY,
} from '@clearedin/providers/registry';
import { PROMPT_VERSION, TAXONOMY_VERSION } from '@clearedin/taxonomy';
import { prepareTrustedSessionStorage } from '@clearedin/storage';
import { createBroker } from '../src/background/broker';
import { LIVE_PROVIDERS, providerPermissions } from '../src/live-providers';

async function broadcast(event: BroadcastMessage) {
  // runtime.sendMessage reaches extension pages. Content scripts receive messages
  // through tabs.sendMessage. Enumerating IDs needs no tab-history permission and
  // works after a worker restart, when a list of registered tabs would be empty.
  const pages = browser.runtime.sendMessage(event).catch(() => undefined);
  const tabs = await browser.tabs.query({});
  await Promise.allSettled([
    pages,
    ...tabs.flatMap(({ id }) =>
      id === undefined
        ? []
        : [browser.tabs.sendMessage(id, event, { frameId: 0 })],
    ),
  ]);
}

async function initializeBroker() {
  const family = import.meta.env.BROWSER === 'firefox' ? 'firefox' : 'chrome';
  const session = await prepareTrustedSessionStorage({
    family,
    area: browser.storage.session ?? null,
    // The Firefox native session-area isolation was tested in the packaged
    // feasibility probe. The minimum browser version is pinned in the manifest.
    nativeIsolationVerified: family === 'firefox',
  });
  return createBroker({
    extension: {
      id: browser.runtime.id,
      optionsUrl: browser.runtime.getURL('/options.html'),
      popupUrl: browser.runtime.getURL('/popup.html'),
      version: browser.runtime.getManifest().version,
    },
    clock: {
      now: Date.now,
      schedule(callback, delay) {
        const timer = setTimeout(callback, delay);
        return () => clearTimeout(timer);
      },
    },
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browser: {
      capabilities: {
        family,
        trustedSessionStorage: session !== null,
        sessionSurvivesBackgroundRestart: session !== null,
      },
      localStorage: {
        get: async (key) => (await browser.storage.local.get(key))[key],
        set: (key, value) => browser.storage.local.set({ [key]: value }),
        remove: (key) => browser.storage.local.remove(key),
        clear: () => browser.storage.local.clear(),
      },
      trustedSessionStorage: session,
      hasProviderPermission: (provider) =>
        browser.permissions.contains(providerPermissions(provider)),
      requestProviderPermission: (provider) =>
        browser.permissions.request(providerPermissions(provider)),
      broadcast,
    },
    live: {
      configuration: (provider) => ({
        provider,
        model: LIVE_PROVIDERS[provider].model,
        adapterVersion: PROVIDER_REGISTRY[provider].adapterVersion,
        promptVersion: PROMPT_VERSION,
        taxonomyVersion: TAXONOMY_VERSION,
      }),
      adapter: (provider) =>
        createProviderAdapter(provider, {
          fetch(url, init) {
            if (provider !== 'anthropic') return fetch(url, init);
            const headers = new Headers(init.headers);
            headers.set('anthropic-dangerous-direct-browser-access', 'true');
            return fetch(url, { ...init, headers });
          },
        }),
      recipientId: (provider) => LIVE_PROVIDERS[provider].recipientId,
    },
  });
}

export default defineBackground(() => {
  const ready = initializeBroker();
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') void browser.runtime.openOptionsPage();
  });
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      (message.type === 'STATUS_CHANGED' || message.type === 'RESTORE_ALL')
    )
      return undefined;
    return ready.then((broker) =>
      broker.handle(message, {
        extensionId: sender.id ?? '',
        url: sender.url ?? '',
        tabId: sender.tab?.id ?? null,
        frameId: sender.frameId ?? null,
      }),
    );
  });
  browser.permissions.onRemoved.addListener(async () => {
    const broker = await ready;
    for (const provider of PROVIDER_IDS) {
      if (
        !(await browser.permissions.contains(providerPermissions(provider)))
      ) {
        await broker.permissionRemoved(provider);
      }
    }
  });
});
