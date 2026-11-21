import {
  ReplyMessageSchema,
  RequestIdSchema,
  type AuthorizedRequest,
  type BrowserPorts,
  type Clock,
  type MessageSender,
  type ProviderId,
  type PublicStatus,
  type ReplyMessage,
  type RequestMessage,
  type SettingsSnapshot,
} from '@clearedin/contracts';
import { createStorage } from '@clearedin/storage';
import { authorizeRequest } from '../messaging/authorization';
import {
  createLiveInference,
  errorCode,
  type LiveProviders,
} from './live-inference';

type RestoreReason =
  'paused' | 'consent_withdrawn' | 'provider_changed' | 'data_cleared';
type TrustedRequest = Exclude<AuthorizedRequest, { surface: 'rejected' }>;
type Mutation = Exclude<
  RequestMessage,
  {
    type:
      | 'GET_PUBLIC_STATUS'
      | 'GET_SETTINGS'
      | 'EXPORT_DIAGNOSTICS'
      | 'TEST_PROVIDER_CONNECTION'
      | 'CLASSIFY_POST'
      | 'CANCEL_SUBSCRIPTION';
  }
>;

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
  live?: LiveProviders;
}) {
  const storage = createStorage(input);
  const live =
    input.live &&
    createLiveInference(input.live, storage, input.browser, input.clock);
  let tail: Promise<unknown> = Promise.resolve();

  function serialize<T>(task: () => Promise<T>) {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  }
  async function publicStatus(): Promise<PublicStatus> {
    const status = await storage.public.readStatus();
    if (!live)
      return {
        ...status,
        enabled: false,
        state: 'unavailable',
        credentialConfigured: false,
        error: status.error ?? {
          code: 'unsupported_provider',
          retryable: false,
        },
      };
    if (status.error) return { ...status, enabled: false };
    if (!status.provider)
      return { ...status, enabled: false, state: 'needs_setup' };
    try {
      live.configuration(status.provider, status.model);
      if (!(await input.browser.hasProviderPermission(status.provider)))
        throw new Error('permission_denied');
      if (!status.credentialConfigured) throw new Error('credential_required');
      if (status.consentGranted) {
        const settings = await storage.public.readSettings();
        if (
          !live.validConsent(
            live.configuration(status.provider, status.model),
            settings.consent,
          )
        )
          return {
            ...status,
            consentGranted: false,
            enabled: false,
            state: 'needs_setup',
            error: { code: 'consent_required', retryable: false },
          };
      }
      return status;
    } catch (cause) {
      return {
        ...status,
        enabled: false,
        state: 'needs_setup',
        error: { code: errorCode(cause), retryable: false },
      };
    }
  }

  async function broadcast(
    requestId: string,
    snapshot: SettingsSnapshot,
    restore?: RestoreReason,
  ) {
    const base = { protocolVersion: 1 as const, requestId };
    if (restore)
      await input.browser
        .broadcast({
          ...base,
          type: 'RESTORE_ALL',
          enablementGeneration: snapshot.enablementGeneration,
          reason: restore,
        })
        .catch(() => undefined);
    await publicStatus()
      .then((status) =>
        input.browser.broadcast({ ...base, type: 'STATUS_CHANGED', status }),
      )
      .catch(() => undefined);
  }

  async function mutate(request: Mutation) {
    if (request.type === 'CLEAR_DATA') {
      live?.reset();
      const snapshot = await storage.clearAll();
      await broadcast(request.requestId, snapshot, 'data_cleared');
      return snapshot;
    }
    if (request.type === 'DISCONNECT_PROVIDER') {
      live?.reset();
      const snapshot = await storage.disconnect(request.provider);
      await broadcast(request.requestId, snapshot, 'provider_changed');
      return snapshot;
    }
    const { settings, enablementGeneration: generation } =
      await storage.settings.read();
    let snapshot: SettingsSnapshot;
    let restore: RestoreReason | undefined;
    switch (request.type) {
      case 'SET_PROVIDER': {
        if (!live) throw new Error('unsupported_provider');
        live.configuration(request.provider, request.model);
        if (
          settings.provider === request.provider &&
          settings.model === request.model
        )
          return { settings, enablementGeneration: generation };
        live.reset();
        const previous = settings.provider
          ? await storage.disconnect(settings.provider, generation)
          : { settings, enablementGeneration: generation };
        snapshot = await storage.settings.write(
          {
            ...previous.settings,
            enabled: false,
            consent: null,
            provider: request.provider,
            model: request.model,
          },
          previous.enablementGeneration,
        );
        restore = 'provider_changed';
        break;
      }
      case 'SET_CREDENTIAL': {
        if (!live) throw new Error('unsupported_provider');
        if (settings.provider !== request.provider)
          throw new Error('unsupported_provider');
        live.configuration(request.provider, settings.model);
        if (!(await input.browser.hasProviderPermission(request.provider)))
          throw new Error('permission_denied');
        live.reset();
        // A key belongs to a provider account. Its retention conditions can differ.
        // Disable and withdraw the previous consent before replacing its secret.
        snapshot = await storage.settings.write(
          { ...settings, enabled: false, consent: null },
          generation,
        );
        try {
          await storage.credentials.set(
            request.provider,
            request.credential,
            snapshot.enablementGeneration,
          );
        } finally {
          await broadcast(request.requestId, snapshot, 'provider_changed');
        }
        return snapshot;
      }
      case 'SET_PREFERENCES':
        snapshot = await storage.settings.write(
          {
            ...settings,
            ...request.preferences,
            enabled: !!live && settings.enabled,
          },
          generation,
        );
        if (!live) restore = 'paused';
        break;
      case 'SET_CONSENT': {
        if (request.consent.status === 'granted') {
          if (!live) throw new Error('unsupported_provider');
          const config = live.configuration(settings.provider, settings.model);
          if (!live.validConsent(config, request.consent))
            throw new Error('consent_required');
          await live.requireEnabledSetup({
            ...settings,
            consent: request.consent,
          });
        } else restore = 'consent_withdrawn';
        live?.reset();
        snapshot = await storage.settings.write(
          { ...settings, enabled: false, consent: request.consent },
          generation,
        );
        break;
      }
      case 'SET_ENABLED':
        if (request.enabled) {
          if (!live) throw new Error('unsupported_provider');
          await live.requireEnabledSetup(settings);
          snapshot = await storage.settings.write(
            { ...settings, enabled: true },
            generation,
          );
        } else {
          live?.reset();
          snapshot = await storage.settings.invalidate(generation);
          restore = 'paused';
        }
        break;
    }
    await broadcast(request.requestId, snapshot, restore);
    return snapshot;
  }

  async function handle(authorized: TrustedRequest): Promise<ReplyMessage> {
    const { request, sender } = authorized;
    const base = { protocolVersion: 1 as const, requestId: request.requestId };
    const owner = (id: string) =>
      JSON.stringify([sender.tabId, sender.frameId, id]);
    try {
      switch (request.type) {
        case 'GET_PUBLIC_STATUS':
          return {
            ...base,
            type: 'PUBLIC_STATUS',
            status: await publicStatus(),
          };
        case 'GET_SETTINGS':
          return {
            ...base,
            type: 'SETTINGS',
            settings: await storage.public.readSettings(),
          };
        case 'EXPORT_DIAGNOSTICS':
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
        case 'CANCEL_SUBSCRIPTION':
          live?.cancel(owner(request.classificationRequestId));
          return {
            ...base,
            type: 'ACK',
            enablementGeneration: (await storage.settings.read())
              .enablementGeneration,
          };
        case 'CLASSIFY_POST': {
          if (!live) throw new Error('unsupported_provider');
          const result = await live.classify(
            owner(request.requestId),
            request.requestId,
            request.post,
            request.enablementGeneration,
          );
          return {
            ...base,
            type: 'CLASSIFICATION_RESULT',
            result,
            identity: request.post.identity,
            enablementGeneration: request.enablementGeneration,
          };
        }
        case 'TEST_PROVIDER_CONNECTION': {
          if (!live) throw new Error('unsupported_provider');
          const config = await live.test();
          return {
            ...base,
            type: 'PROVIDER_TEST_RESULT',
            provider: config.provider,
            model: config.model,
            outcome: 'passed',
            error: null,
          };
        }
        default:
          return {
            ...base,
            type: 'ACK',
            enablementGeneration: (await mutate(request)).enablementGeneration,
          };
      }
    } catch (cause) {
      return {
        ...base,
        type: 'ERROR',
        error: { code: errorCode(cause), retryable: false },
      };
    }
  }

  return {
    async handle(raw: unknown, sender: MessageSender): Promise<ReplyMessage> {
      const authorized = authorizeRequest(raw, sender, input.extension);
      if (authorized.surface === 'rejected') {
        // A valid public request can still come from a forbidden surface. Keep its ID for correlation.
        const id =
          raw && typeof raw === 'object' && 'requestId' in raw
            ? raw.requestId
            : null;
        return ReplyMessageSchema.parse({
          protocolVersion: 1,
          requestId: RequestIdSchema.safeParse(id).data ?? 'rejected',
          type: 'ERROR',
          error: authorized.error,
        });
      }
      // Mutations are ordered across tabs, but a slow network request never blocks pause, revoke, or reset.
      const kind = authorized.request.type;
      const result =
        kind === 'CLASSIFY_POST' ||
        kind === 'TEST_PROVIDER_CONNECTION' ||
        kind === 'CANCEL_SUBSCRIPTION'
          ? tail.then(() => handle(authorized))
          : serialize(() => handle(authorized));
      return ReplyMessageSchema.parse(await result);
    },
    permissionRemoved(provider: ProviderId) {
      return serialize(async () => {
        const snapshot = await storage.settings.read();
        if (snapshot.settings.provider !== provider) return;
        live?.reset();
        const cleared = await storage.disconnect(
          provider,
          snapshot.enablementGeneration,
        );
        await broadcast('permission-removed', cleared, 'provider_changed');
      });
    },
  };
}
