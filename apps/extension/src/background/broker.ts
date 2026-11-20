import {
  RequestMessageSchema,
  ReplyMessageSchema,
  type BrowserPorts,
  type Clock,
  type MessageSender,
  type PublicStatus,
  type ReplyMessage,
  type ErrorCode,
} from '@clearedin/contracts';
import { createStorage, StorageError } from '@clearedin/storage';
import { authorizeRequest } from '../messaging/authorization';

/** The production broker persists non-secret settings. Live inference stays gated. */
export function createBroker(input: {
  browser: BrowserPorts;
  clock: Clock;
  timeZone: string;
  extension: {
    id: string;
    optionsUrl: string;
    popupUrl: string;
    version: string;
  };
}) {
  const storage = createStorage(input);
  let tail: Promise<unknown> = Promise.resolve();
  async function readPreviewStatus(): Promise<PublicStatus> {
    const status = await storage.public.readStatus();
    return {
      ...status,
      enabled: false,
      state: 'unavailable',
      credentialConfigured: false,
      error: status.error ?? { code: 'unsupported_provider', retryable: false },
    };
  }
  async function handle(
    raw: unknown,
    sender: MessageSender,
  ): Promise<ReplyMessage> {
    const parsed = RequestMessageSchema.safeParse(raw);
    const base = {
      protocolVersion: 1 as const,
      requestId: parsed.success ? parsed.data.requestId : 'rejected',
    };
    const error = (code: ErrorCode): ReplyMessage => ({
      ...base,
      type: 'ERROR',
      error: { code, retryable: false },
    });
    const authorized = authorizeRequest(raw, sender, input.extension);
    if (authorized.surface === 'rejected') return error(authorized.error.code);
    const request = authorized.request;
    try {
      if (request.type === 'GET_PUBLIC_STATUS') {
        return {
          ...base,
          type: 'PUBLIC_STATUS',
          status: await readPreviewStatus(),
        };
      }
      if (request.type === 'GET_SETTINGS')
        return {
          ...base,
          type: 'SETTINGS',
          settings: await storage.public.readSettings(),
        };
      if (request.type === 'EXPORT_DIAGNOSTICS')
        return {
          ...base,
          type: 'DIAGNOSTICS',
          diagnostics: {
            schemaVersion: 1,
            extensionVersion: input.extension.version,
            browserFamily: input.browser.capabilities.family,
            events: [...storage.diagnostics.read()],
          },
        };
      if (request.type === 'CANCEL_SUBSCRIPTION')
        return {
          ...base,
          type: 'ACK',
          enablementGeneration: (await storage.settings.read())
            .enablementGeneration,
        };
      if (
        request.type === 'CLASSIFY_POST' ||
        request.type === 'SET_CREDENTIAL' ||
        request.type === 'SET_PROVIDER' ||
        request.type === 'TEST_PROVIDER_CONNECTION'
      )
        return error('unsupported_provider');
      if (request.type === 'SET_ENABLED' && request.enabled)
        return error('unsupported_provider');
      if (
        request.type === 'SET_CONSENT' &&
        request.consent.status === 'granted'
      )
        return error('unsupported_provider');
      let snapshot;
      let reason:
        'paused' | 'consent_withdrawn' | 'provider_changed' | 'data_cleared' =
        'paused';
      if (request.type === 'CLEAR_DATA') {
        snapshot = await storage.clearAll();
        reason = 'data_cleared';
      } else if (request.type === 'DISCONNECT_PROVIDER') {
        snapshot = await storage.disconnect(request.provider);
        reason = 'provider_changed';
      } else {
        const { settings, enablementGeneration: generation } =
          await storage.settings.read();
        if (request.type === 'SET_PREFERENCES')
          snapshot = await storage.settings.write(
            { ...settings, ...request.preferences, enabled: false },
            generation,
          );
        else if (request.type === 'SET_CONSENT') {
          snapshot = await storage.settings.write(
            { ...settings, enabled: false, consent: request.consent },
            generation,
          );
          reason = 'consent_withdrawn';
        } else snapshot = await storage.settings.invalidate(generation);
      }
      // Persistence succeeds before broadcasts. A closed UI must not undo a write.
      await input.browser
        .broadcast({
          ...base,
          type: 'RESTORE_ALL',
          enablementGeneration: snapshot.enablementGeneration,
          reason,
        })
        .catch(() => undefined);
      await readPreviewStatus()
        .then((status) =>
          input.browser.broadcast({
            ...base,
            type: 'STATUS_CHANGED',
            status,
          }),
        )
        .catch(() => undefined);
      return {
        ...base,
        type: 'ACK',
        enablementGeneration: snapshot.enablementGeneration,
      };
    } catch (cause) {
      return error(
        cause instanceof StorageError ? cause.code : 'internal_error',
      );
    }
  }
  return {
    handle(raw: unknown, sender: MessageSender): Promise<ReplyMessage> {
      // Serialize read-modify-write operations across every tab and UI surface.
      const result = tail
        .then(() => handle(raw, sender))
        .then((value) => ReplyMessageSchema.parse(value));
      tail = result.catch(() => undefined);
      return result;
    },
  };
}
