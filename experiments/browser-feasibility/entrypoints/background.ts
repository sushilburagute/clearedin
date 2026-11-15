import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import {
  PublicStatusSchema,
  ReplyMessageSchema,
  RequestMessageSchema,
  createDefaultSettings,
} from '@clearedin/contracts';
import {
  authorizeCanonical,
  isProbeCommand,
  senderSurface,
} from '../src/authorization.ts';
import { createSessionProbe } from '../src/session.ts';

export default defineBackground(() => {
  const bootId = globalThis.crypto.randomUUID();
  const session = createSessionProbe(
    browser.storage.session,
    import.meta.env.BROWSER === 'firefox' ? 'firefox' : 'chrome',
  );
  browser.runtime.onMessage.addListener(async (message: unknown, sender) => {
    const surface = senderSurface(
      {
        extensionId: sender.id ?? '',
        url: sender.url ?? '',
        tabId: sender.tab?.id ?? null,
        frameId: sender.frameId ?? null,
      },
      browser.runtime.id,
      browser.runtime.getURL('/options.html'),
    );
    const denied = { type: 'PROBE_DENIED' };
    if (surface === 'rejected') return denied;
    try {
      if (surface === 'options' && isProbeCommand(message, 'PROBE_SNAPSHOT')) {
        return {
          type: 'PROBE_SNAPSHOT',
          bootId,
          trustedSession: await session.ready,
          sessionApiAvailable: Boolean(browser.storage.session),
          accessLevelApiAvailable:
            typeof browser.storage.session?.setAccessLevel === 'function',
          credentialConfigured: await session.configured(),
          localEmpty:
            Object.keys(await browser.storage.local.get(null)).length === 0,
          syncEmpty:
            Object.keys(await browser.storage.sync.get(null)).length === 0,
          optionalHostGranted: await browser.permissions.contains({
            origins: ['https://example.com/*'],
          }),
          backgroundKind:
            import.meta.env.BROWSER === 'firefox'
              ? 'event-page'
              : 'service-worker',
        };
      }
      if (!authorizeCanonical(surface, message)) return denied;
      const request = RequestMessageSchema.parse(message);
      if (request.type === 'SET_CREDENTIAL') {
        // Accept only the known dummy. Never use this probe to enter real keys.
        if (request.credential !== 'synthetic-only-not-a-provider-key')
          return denied;
        if (!(await session.seed())) return { type: 'PROBE_UNAVAILABLE' };
        return ReplyMessageSchema.parse({
          protocolVersion: 1,
          requestId: request.requestId,
          type: 'ACK',
          enablementGeneration: 0,
        });
      }
      if (request.type === 'CLEAR_DATA') {
        await session.clear();
        return ReplyMessageSchema.parse({
          protocolVersion: 1,
          requestId: request.requestId,
          type: 'ACK',
          enablementGeneration: 0,
        });
      }
      if (request.type === 'GET_PUBLIC_STATUS') {
        const settings = createDefaultSettings();
        const status = PublicStatusSchema.parse({
          enabled: false,
          enablementGeneration: 0,
          provider: null,
          model: null,
          credentialConfigured: await session.configured(),
          consentGranted: false,
          categoryModes: settings.categoryModes,
          state: 'disabled',
          error: null,
          dailyRequestsUsed: 0,
          dailyRequestLimit: 1,
          resetAt: null,
          resetTimeZone: 'UTC',
          sessionHiddenCount: 0,
        });
        return {
          protocolVersion: 1,
          requestId: request.requestId,
          type: 'PUBLIC_STATUS',
          status,
        };
      }
      return denied;
    } catch {
      return { type: 'PROBE_UNAVAILABLE' };
    }
  });
});
