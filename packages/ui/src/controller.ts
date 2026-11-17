import {
  BroadcastMessageSchema,
  DiagnosticExportSchema,
  PreferencesSchema,
  ReplyMessageSchema,
  type OptionsClient,
  type OptionsRequest,
  type PopupClient,
  type PopupRequest,
  type PublicStatus,
  type Settings,
  type DiagnosticExport,
  type ProviderId,
  type Preferences,
  type PublicError,
  type ErrorCode,
  type ConsentRecord,
  type ReplyFor,
} from '@clearedin/contracts';
import type { ProviderChoice } from './catalog';

export interface UiEnvironment {
  mode: 'unavailable' | 'demo' | 'connected';
  providers: readonly ProviderChoice[];
  credentialEntry: boolean;
  hasPermission(provider: ProviderId): Promise<boolean>;
  /** Must be invoked immediately from the permission button's user gesture. */
  requestPermission(provider: ProviderId): Promise<boolean>;
  now(): number;
}

export const ERROR_COPY: Record<ErrorCode, string> = {
  invalid_request: 'Check the settings and try again.',
  unauthorized_sender: 'This page cannot access the extension service.',
  unsupported_route: 'Filtering runs on the LinkedIn home feed.',
  not_enabled: 'Filtering is paused.',
  consent_required: 'Review the disclosure and consent before enabling.',
  credential_required: 'Enter your provider credential in settings.',
  invalid_credential:
    'The provider rejected this credential. Update the key in settings.',
  permission_denied:
    'Provider host access was not granted. Grant access in settings to continue.',
  unsupported_provider: 'This provider is not available in this build.',
  unsupported_model: 'Select an available model and test the connection again.',
  provider_unavailable:
    'The provider is unavailable or the connection is offline. Posts stay visible.',
  rate_limited:
    'The provider rate limit was reached. Posts stay visible while waiting to retry.',
  daily_limit:
    'The daily request limit was reached. Posts stay visible until the limit resets.',
  estimated_cost_limit:
    'The estimated cost cap was reached or cost is unavailable. Posts stay visible.',
  queue_full: 'The request queue is full. Posts stay visible.',
  timeout:
    'The connection timed out. Posts stay visible. Try the synthetic test again.',
  cancelled: 'The operation was cancelled. Posts stay visible.',
  invalid_response:
    'The provider returned an unsupported response. Posts stay visible.',
  refused:
    'The provider declined to classify this content. Posts stay visible.',
  storage_unavailable:
    'Local extension storage is unavailable. Filtering stays disabled.',
  unsupported_schema:
    'Stored settings require a newer extension. Update or explicitly clear all data.',
  internal_error: 'The extension service is unavailable. Posts stay visible.',
};

export interface UiSnapshot {
  settings: Settings | null;
  status: PublicStatus | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string;
  test: 'idle' | 'pending' | 'passed' | 'failed';
  permission: boolean;
  diagnostics: DiagnosticExport | null;
}

function initial(): UiSnapshot {
  return {
    settings: null,
    status: null,
    loading: true,
    busy: false,
    error: null,
    notice: '',
    test: 'idle',
    permission: false,
    diagnostics: null,
  };
}

let sequence = 0;
function envelope() {
  return { protocolVersion: 1 as const, requestId: `ui-${++sequence}` };
}

/** Validates replies again at the UI boundary; errors never include raw transport text. */
async function send<R extends OptionsRequest>(
  client: OptionsClient,
  request: R,
): Promise<ReplyFor<R>> {
  const raw = await client.send(request);
  const result = ReplyMessageSchema.safeParse(raw);
  if (!result.success || result.data.requestId !== request.requestId)
    throw new Error(ERROR_COPY.internal_error);
  if (result.data.type === 'ERROR')
    throw new Error(ERROR_COPY[result.data.error.code]);
  const expected =
    request.type === 'GET_SETTINGS'
      ? 'SETTINGS'
      : request.type === 'GET_PUBLIC_STATUS'
        ? 'PUBLIC_STATUS'
        : request.type === 'EXPORT_DIAGNOSTICS'
          ? 'DIAGNOSTICS'
          : request.type === 'TEST_PROVIDER_CONNECTION'
            ? 'PROVIDER_TEST_RESULT'
            : 'ACK';
  if (result.data.type !== expected) throw new Error(ERROR_COPY.internal_error);
  return result.data as ReplyFor<R>;
}

function safeError(error: unknown): string {
  return error instanceof Error &&
    Object.values(ERROR_COPY).includes(error.message)
    ? error.message
    : ERROR_COPY.internal_error;
}

export function createOptionsController(
  client: OptionsClient,
  environment: UiEnvironment,
) {
  let state = initial();
  const listeners = new Set<() => void>();
  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  let version = 0;
  let statusRevision = 0;
  let operationEpoch = 0;
  let refreshAfterOperation = false;
  const publish = (change: Partial<UiSnapshot>) => {
    if (disposed) return;
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };
  const selected = () =>
    environment.providers.find(
      (provider) => provider.id === state.settings?.provider,
    );
  async function reload() {
    const current = ++version;
    const settingsReply = await send(client, {
      ...envelope(),
      type: 'GET_SETTINGS',
    });
    const readStatusRevision = statusRevision;
    const statusReply = await send(client, {
      ...envelope(),
      type: 'GET_PUBLIC_STATUS',
    });
    if (
      settingsReply.type !== 'SETTINGS' ||
      statusReply.type !== 'PUBLIC_STATUS'
    )
      throw new Error(ERROR_COPY.internal_error);
    const permission =
      settingsReply.settings.provider !== null &&
      (await environment.hasPermission(settingsReply.settings.provider));
    if (current === version)
      publish({
        settings: settingsReply.settings,
        status:
          readStatusRevision === statusRevision
            ? statusReply.status
            : state.status,
        permission,
      });
  }
  async function run(action: () => Promise<void>, notice: string) {
    if (state.busy || disposed) return;
    publish({ busy: true, error: null, notice: '' });
    try {
      await action();
      publish({ notice });
    } catch (error) {
      publish({ error: safeError(error) });
    } finally {
      if (refreshAfterOperation && !disposed) {
        refreshAfterOperation = false;
        try {
          await reload();
        } catch (error) {
          publish({ error: safeError(error) });
        }
      }
      publish({ busy: false, loading: false });
    }
  }
  const mutation = async (request: OptionsRequest) => {
    await send(client, request);
    await reload();
  };
  return {
    environment,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      if (!unsubscribe)
        unsubscribe = client.subscribe((raw) => {
          const event = BroadcastMessageSchema.safeParse(raw);
          if (!event.success) return;
          const message = event.data;
          const previous = state.status;
          const incomingGeneration =
            message.type === 'STATUS_CHANGED'
              ? message.status.enablementGeneration
              : message.enablementGeneration;
          if (previous && incomingGeneration < previous.enablementGeneration)
            return;
          let invalidateTest: boolean;
          if (message.type === 'STATUS_CHANGED') {
            ++statusRevision;
            const status = message.status;
            invalidateTest =
              !!previous &&
              (previous.provider !== status.provider ||
                previous.model !== status.model ||
                previous.credentialConfigured !== status.credentialConfigured ||
                (previous.consentGranted && !status.consentGranted) ||
                status.error?.code === 'invalid_credential' ||
                status.error?.code === 'permission_denied');
            publish({ status });
            // Progress/usage broadcasts must not invalidate a connection test or
            // reload the settings form while the user is editing it.
            if (
              previous &&
              !invalidateTest &&
              previous.enablementGeneration === incomingGeneration
            )
              return;
          } else {
            invalidateTest = [
              'provider_changed',
              'data_cleared',
              'consent_withdrawn',
            ].includes(message.reason);
          }
          if (invalidateTest) {
            ++operationEpoch;
            publish({ test: 'idle', diagnostics: null });
          }
          ++version;
          if (state.busy) {
            refreshAfterOperation = true;
            return;
          }
          // Reload settings as well: another options page may have changed consent/configuration.
          void run(async () => {
            await reload();
          }, 'Settings updated.');
        });
      await run(reload, '');
    },
    refresh() {
      return run(reload, 'Settings reloaded.');
    },
    selectProvider(provider: ProviderId, model: string) {
      const choice = environment.providers.find((item) => item.id === provider);
      if (
        !choice?.available ||
        !choice.models.some((item) => item.id === model)
      )
        return;
      publish({ test: 'idle', permission: false, diagnostics: null });
      return run(
        () =>
          mutation({ ...envelope(), type: 'SET_PROVIDER', provider, model }),
        'Provider saved. Review and confirm consent for this recipient.',
      );
    },
    requestPermission() {
      const provider = selected();
      if (!provider?.available || state.busy) return;
      // Invoke before entering an async continuation, preserving the browser user gesture.
      let request: Promise<boolean>;
      try {
        request = environment.requestPermission(provider.id);
      } catch {
        publish({ error: ERROR_COPY.permission_denied });
        return;
      }
      return run(async () => {
        const permission = await request;
        publish({ permission, test: 'idle' });
        if (!permission) throw new Error(ERROR_COPY.permission_denied);
      }, 'Provider host access granted.');
    },
    setCredential(credential: string) {
      const provider = selected();
      if (
        !provider?.available ||
        !environment.credentialEntry ||
        environment.mode !== 'connected' ||
        !state.permission
      )
        return;
      publish({ test: 'idle' });
      // No credential is retained in snapshot, errors, logs, or diagnostic previews.
      return run(
        () =>
          mutation({
            ...envelope(),
            type: 'SET_CREDENTIAL',
            provider: provider.id,
            credential,
          }),
        'Credential sent to the privileged session broker.',
      );
    },
    testConnection() {
      const provider = selected();
      if (
        !provider?.available ||
        !state.permission ||
        !state.status?.credentialConfigured
      )
        return;
      if (state.busy) return;
      const epoch = operationEpoch;
      const expectedProvider = state.settings?.provider;
      const expectedModel = state.settings?.model;
      publish({ test: 'pending' });
      return run(
        async () => {
          try {
            const reply = await send(client, {
              ...envelope(),
              type: 'TEST_PROVIDER_CONNECTION',
            });
            if (
              disposed ||
              epoch !== operationEpoch ||
              expectedProvider !== state.status?.provider ||
              expectedModel !== state.status?.model
            )
              throw new Error(ERROR_COPY.cancelled);
            if (
              reply.type !== 'PROVIDER_TEST_RESULT' ||
              reply.provider !== expectedProvider ||
              reply.model !== expectedModel
            )
              throw new Error(ERROR_COPY.internal_error);
            publish({ test: reply.outcome === 'passed' ? 'passed' : 'failed' });
            if (reply.error) throw new Error(ERROR_COPY[reply.error.code]);
            await reload();
          } catch (error) {
            publish({ test: epoch === operationEpoch ? 'failed' : 'idle' });
            throw error;
          }
        },
        environment.mode === 'demo'
          ? 'Synthetic UI simulation passed. No provider was contacted.'
          : 'Synthetic connection test passed. It may count toward your request limit and provider bill.',
      );
    },
    setPreferences(preferences: Preferences) {
      const validated = PreferencesSchema.safeParse(preferences);
      if (!validated.success) {
        publish({ error: ERROR_COPY.invalid_request });
        return;
      }
      return run(
        () =>
          mutation({
            ...envelope(),
            type: 'SET_PREFERENCES',
            preferences: validated.data,
          }),
        'Rules and limits saved.',
      );
    },
    consent(granted: boolean) {
      const provider = selected();
      const previous = state.settings?.consent;
      if (
        granted &&
        (!provider?.available ||
          (!provider.retentionUrl && environment.mode !== 'demo') ||
          state.test !== 'passed')
      )
        return;
      if (!granted && previous?.status !== 'granted') return;
      // Withdrawing must remain possible when a configured provider becomes unavailable.
      const consent: ConsentRecord =
        !granted && previous
          ? {
              ...previous,
              timestamp: environment.now(),
              status: 'withdrawn',
            }
          : {
              version: '1',
              provider: provider!.id,
              recipientId: provider!.recipientId,
              dataClasses: ['post_text', 'classification_instructions'],
              timestamp: environment.now(),
              status: granted ? 'granted' : 'withdrawn',
            };
      return run(
        () => mutation({ ...envelope(), type: 'SET_CONSENT', consent }),
        granted
          ? 'Consent recorded. You can now enable filtering.'
          : 'Consent withdrawn. Filtering is disabled and hidden posts are restored.',
      );
    },
    setEnabled(enabled: boolean) {
      if (
        enabled &&
        (!state.status?.credentialConfigured ||
          state.settings?.consent?.status !== 'granted' ||
          !state.permission ||
          state.test !== 'passed')
      )
        return;
      return run(
        () => mutation({ ...envelope(), type: 'SET_ENABLED', enabled }),
        enabled
          ? 'Filtering enabled.'
          : 'Filtering paused. Hidden posts are restored.',
      );
    },
    disconnect() {
      if (!state.settings?.provider) return;
      const provider = state.settings.provider;
      publish({ test: 'idle', diagnostics: null });
      return run(
        () =>
          mutation({ ...envelope(), type: 'DISCONNECT_PROVIDER', provider }),
        'Provider disconnected. The session credential was removed.',
      );
    },
    clearData() {
      publish({ test: 'idle', diagnostics: null });
      return run(
        () => mutation({ ...envelope(), type: 'CLEAR_DATA' }),
        'Local extension data cleared. Filtering is disabled.',
      );
    },
    previewDiagnostics() {
      return run(async () => {
        const reply = await send(client, {
          ...envelope(),
          type: 'EXPORT_DIAGNOSTICS',
        });
        if (reply.type !== 'DIAGNOSTICS')
          throw new Error(ERROR_COPY.internal_error);
        publish({
          diagnostics: DiagnosticExportSchema.parse(reply.diagnostics),
        });
      }, 'Review the sanitized preview before choosing to share it.');
    },
    dispose() {
      disposed = true;
      ++version;
      ++operationEpoch;
      unsubscribe?.();
      listeners.clear();
      state = initial();
    },
  };
}

export type OptionsController = ReturnType<typeof createOptionsController>;

export function createPopupController(client: PopupClient) {
  let state = initial();
  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  let statusVersion = 0;
  const listeners = new Set<() => void>();
  const publish = (change: Partial<UiSnapshot>) => {
    if (disposed) return;
    state = { ...state, ...change };
    listeners.forEach((listener) => listener());
  };
  async function getStatus() {
    const version = ++statusVersion;
    const request = { ...envelope(), type: 'GET_PUBLIC_STATUS' as const };
    const reply = await client.send(request);
    const parsed = ReplyMessageSchema.safeParse(reply);
    if (
      !parsed.success ||
      parsed.data.requestId !== request.requestId ||
      parsed.data.type !== 'PUBLIC_STATUS'
    ) {
      const error =
        parsed.success && parsed.data.type === 'ERROR'
          ? parsed.data.error
          : null;
      throw new Error(
        error ? ERROR_COPY[error.code] : ERROR_COPY.internal_error,
      );
    }
    if (version === statusVersion) publish({ status: parsed.data.status });
  }
  async function run(action: () => Promise<void>) {
    if (state.busy || disposed) return;
    publish({ busy: true, error: null });
    try {
      await action();
    } catch (error) {
      publish({ error: safeError(error) });
    } finally {
      publish({ busy: false, loading: false });
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async start() {
      unsubscribe ??= client.subscribe((raw) => {
        const event = BroadcastMessageSchema.safeParse(raw);
        if (event.success && event.data.type === 'STATUS_CHANGED') {
          if (
            state.status &&
            event.data.status.enablementGeneration <
              state.status.enablementGeneration
          )
            return;
          ++statusVersion;
          publish({ status: event.data.status });
        }
      });
      await run(getStatus);
    },
    setEnabled(enabled: boolean) {
      return run(async () => {
        const request: PopupRequest = {
          ...envelope(),
          type: 'SET_ENABLED',
          enabled,
        };
        const raw = await client.send(request);
        const reply = ReplyMessageSchema.safeParse(raw);
        if (
          !reply.success ||
          reply.data.requestId !== request.requestId ||
          reply.data.type !== 'ACK'
        ) {
          throw new Error(
            reply.success && reply.data.type === 'ERROR'
              ? ERROR_COPY[reply.data.error.code]
              : ERROR_COPY.internal_error,
          );
        }
        await getStatus();
        publish({
          notice: enabled
            ? 'Filtering resumed.'
            : 'Filtering paused. Hidden posts are restored.',
        });
      });
    },
    dispose() {
      disposed = true;
      unsubscribe?.();
      listeners.clear();
    },
  };
}
export type PopupController = ReturnType<typeof createPopupController>;

export function statusCopy(status: PublicStatus): string {
  if (status.error) return ERROR_COPY[status.error.code];
  if (status.state === 'needs_setup')
    return 'Complete provider setup in settings. Posts stay visible.';
  if (status.state === 'unavailable') return ERROR_COPY.provider_unavailable;
  if (status.state === 'limited')
    return 'A usage limit is active. Posts stay visible.';
  if (status.state === 'working')
    return 'Classifying visible feed text. Pending posts stay visible.';
  return status.enabled
    ? 'Filtering is active on the LinkedIn home feed.'
    : 'Filtering is paused. Your feed stays visible.';
}

/** The displayed time and zone must agree, including when the local browser zone differs. */
export function resetCopy(status: PublicStatus): string | null {
  if (status.resetAt === null) return null;
  try {
    return `Resets ${new Date(status.resetAt).toLocaleString(undefined, { timeZone: status.resetTimeZone })} (${status.resetTimeZone}).`;
  } catch {
    return `Resets ${new Date(status.resetAt).toISOString()} (UTC).`;
  }
}

export function publicError(code: ErrorCode): PublicError {
  return { code, retryable: false };
}
