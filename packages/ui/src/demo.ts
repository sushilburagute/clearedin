import {
  createDefaultSettings,
  PreferencesSchema,
  SettingsSchema,
  type OptionsClient,
  type OptionsRequest,
  type ReplyFor,
  type ReplyMessage,
  type PublicStatus,
  type Settings,
} from '@clearedin/contracts';
import { publicError, type UiEnvironment } from './controller';
import { UNAVAILABLE_PROVIDERS } from './catalog';

/** No browser messaging, persistence, credential storage, or network implementation. */
export function createUnavailableClient(): OptionsClient {
  return {
    async send(request) {
      return {
        protocolVersion: 1,
        requestId: request.requestId,
        type: 'ERROR',
        error: publicError('internal_error'),
      };
    },
    subscribe() {
      return () => {};
    },
  };
}

export const UNAVAILABLE_ENVIRONMENT: UiEnvironment = {
  mode: 'unavailable',
  providers: UNAVAILABLE_PROVIDERS,
  credentialEntry: false,
  async hasPermission() {
    return false;
  },
  async requestPermission() {
    return false;
  },
  now: () => Date.now(),
};

/** Explicit opt-in UI simulation, NEVER a ClassifierAdapter or working provider. */
export function createDemoSession(): {
  client: OptionsClient;
  environment: UiEnvironment;
} {
  let settings: Settings = createDefaultSettings();
  let generation = 0;
  let permission = false;
  const status = (): PublicStatus => ({
    enabled: settings.enabled,
    enablementGeneration: generation,
    provider: settings.provider,
    model: settings.model,
    credentialConfigured: settings.provider !== null,
    consentGranted: settings.consent?.status === 'granted',
    categoryModes: settings.categoryModes,
    state: settings.enabled
      ? 'ready'
      : settings.provider
        ? 'disabled'
        : 'needs_setup',
    error: null,
    dailyRequestsUsed: 0,
    dailyRequestLimit: settings.dailyRequestLimit,
    resetAt: null,
    resetTimeZone: 'UTC',
    sessionHiddenCount: 0,
  });
  const client: OptionsClient = {
    async send<R extends OptionsRequest>(request: R): Promise<ReplyFor<R>> {
      const base = {
        protocolVersion: 1 as const,
        requestId: request.requestId,
      };
      let reply: ReplyMessage;
      switch (request.type) {
        case 'GET_SETTINGS':
          reply = {
            ...base,
            type: 'SETTINGS',
            settings: structuredClone(settings),
          };
          break;
        case 'GET_PUBLIC_STATUS':
          reply = { ...base, type: 'PUBLIC_STATUS', status: status() };
          break;
        case 'SET_PROVIDER':
          if (request.model !== 'SYNTHETIC-UI-ONLY') {
            reply = {
              ...base,
              type: 'ERROR',
              error: publicError('unsupported_model'),
            };
            break;
          }
          settings = {
            ...settings,
            enabled: false,
            provider: request.provider,
            model: request.model,
            consent: null,
          };
          permission = false;
          ++generation;
          reply = { ...base, type: 'ACK', enablementGeneration: generation };
          break;
        case 'SET_CREDENTIAL':
          // Credentials are rejected even when this test-only client is called directly.
          reply = {
            ...base,
            type: 'ERROR',
            error: publicError('unsupported_provider'),
          };
          break;
        case 'SET_PREFERENCES':
          settings = {
            ...settings,
            ...PreferencesSchema.parse(request.preferences),
          };
          reply = { ...base, type: 'ACK', enablementGeneration: generation };
          break;
        case 'SET_CONSENT':
          settings = SettingsSchema.parse({
            ...settings,
            consent: request.consent,
            enabled: request.consent.status === 'granted' && settings.enabled,
          });
          ++generation;
          reply = { ...base, type: 'ACK', enablementGeneration: generation };
          break;
        case 'SET_ENABLED':
          if (
            request.enabled &&
            (!permission || settings.consent?.status !== 'granted')
          ) {
            reply = {
              ...base,
              type: 'ERROR',
              error: publicError('consent_required'),
            };
            break;
          }
          settings = SettingsSchema.parse({
            ...settings,
            enabled: request.enabled,
          });
          ++generation;
          reply = { ...base, type: 'ACK', enablementGeneration: generation };
          break;
        case 'TEST_PROVIDER_CONNECTION':
          reply =
            settings.provider && permission
              ? {
                  ...base,
                  type: 'PROVIDER_TEST_RESULT',
                  provider: settings.provider,
                  model: 'SYNTHETIC-UI-ONLY',
                  outcome: 'passed',
                  error: null,
                }
              : {
                  ...base,
                  type: 'ERROR',
                  error: publicError('permission_denied'),
                };
          break;
        case 'DISCONNECT_PROVIDER':
          settings = {
            ...settings,
            enabled: false,
            provider: null,
            model: null,
            consent: null,
          };
          permission = false;
          ++generation;
          reply = { ...base, type: 'ACK', enablementGeneration: generation };
          break;
        case 'CLEAR_DATA':
          settings = createDefaultSettings();
          permission = false;
          ++generation;
          reply = { ...base, type: 'ACK', enablementGeneration: generation };
          break;
        case 'EXPORT_DIAGNOSTICS':
          reply = {
            ...base,
            type: 'DIAGNOSTICS',
            diagnostics: {
              schemaVersion: 1,
              extensionVersion: '0.1.0-demo',
              browserFamily: 'chrome',
              events: [],
            },
          };
          break;
      }
      return reply as ReplyFor<R>;
    },
    subscribe() {
      return () => {};
    },
  };
  return {
    client,
    environment: {
      mode: 'demo',
      credentialEntry: false,
      providers: UNAVAILABLE_PROVIDERS.map((provider) => ({
        ...provider,
        available: true,
        label: `${provider.label} (UI simulation)`,
        models: [
          {
            id: 'SYNTHETIC-UI-ONLY',
            label: 'Synthetic UI model — no live provider',
          },
        ],
        retentionUrl: null,
        recipientId: 'Synthetic UI simulation; no recipient',
        permissionLabel: 'simulated host (no browser permission requested)',
      })),
      async hasPermission() {
        return permission;
      },
      async requestPermission() {
        permission = true;
        return true;
      },
      now: () => Date.now(),
    },
  };
}
