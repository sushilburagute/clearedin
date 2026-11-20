import {
  PublicStatusSchema,
  ProviderIdSchema,
  GenerationSchema,
  createDefaultSettings,
  type BrowserPorts,
  type Clock,
  type ProviderId,
  type PublicStatus,
} from '@clearedin/contracts';
import {
  MIGRATION_BACKUP_KEY,
  USAGE_KEY,
  SETTINGS_KEY,
  StorageError,
  checkResetGeneration,
  nextGeneration,
  storageContext,
} from './core';
import { createSettingsStore } from './settings';
import { createCredentialStore } from './credentials';
import { createUsageStore } from './usage';
import { createClassificationCache, createDiagnosticsBuffer } from './memory';

export {
  StorageError,
  SETTINGS_KEY,
  USAGE_KEY,
  MIGRATION_BACKUP_KEY,
  migrateSettings,
} from './core';
export { prepareTrustedSessionStorage, type SessionArea } from './credentials';
export {
  estimateKnownCost,
  type KnownPricing,
  type BillingUnits,
} from './pricing';
export {
  createClassificationCache,
  createDiagnosticsBuffer,
  CACHE_TTL_MS,
  CACHE_MAX_ENTRIES,
  DIAGNOSTICS_MAX_EVENTS,
  type ClassificationCacheOptions,
} from './memory';

/** Construct only in the trusted background. Task 11 owns scheduling and sender authorization. */
export function createStorage(input: {
  browser: BrowserPorts;
  clock: Pick<Clock, 'now'>;
  timeZone: string;
}) {
  const { browser, clock, timeZone } = input;
  const context = storageContext(browser.localStorage);
  const settings = createSettingsStore(context);
  const { store: credentials, readCredential } = createCredentialStore(
    context,
    browser,
  );
  const { store: usage, readSnapshot: readUsageSnapshot } = createUsageStore(
    context,
    clock,
    timeZone,
  );
  const cache = createClassificationCache({ clock });
  const diagnostics = createDiagnosticsBuffer();
  return {
    settings,
    credentials,
    usage,
    cache,
    diagnostics,
    /** Public surfaces receive these validated snapshots, never the storage facade. */
    public: {
      async readSettings() {
        return (await settings.read()).settings;
      },
      async readStatus(): Promise<PublicStatus> {
        return context.run(async () => {
          let snapshot;
          try {
            snapshot = await context.readSettings();
          } catch (error) {
            if (
              !(error instanceof StorageError) ||
              !['unsupported_schema', 'invalid_request'].includes(error.code)
            )
              throw error;
            const raw = await context.local.get(SETTINGS_KEY);
            const storedGeneration =
              raw && typeof raw === 'object' && 'enablementGeneration' in raw
                ? raw.enablementGeneration
                : 0;
            const defaults = createDefaultSettings();
            return PublicStatusSchema.parse({
              enabled: false,
              enablementGeneration: GenerationSchema.safeParse(storedGeneration)
                .success
                ? storedGeneration
                : 0,
              provider: null,
              model: null,
              credentialConfigured: false,
              consentGranted: false,
              categoryModes: defaults.categoryModes,
              state: 'unavailable',
              error: { code: 'unsupported_schema', retryable: false },
              dailyRequestsUsed: 0,
              dailyRequestLimit: defaults.dailyRequestLimit,
              resetAt: null,
              resetTimeZone: timeZone,
              sessionHiddenCount: 0,
            });
          }
          const count = await readUsageSnapshot();
          let configured = false;
          let unavailable = false;
          if (snapshot.settings.provider) {
            try {
              configured =
                (await readCredential(snapshot.settings.provider)) !== null;
            } catch {
              unavailable = true;
            }
          }
          const state = snapshot.settings;
          return PublicStatusSchema.parse({
            enabled: state.enabled,
            enablementGeneration: snapshot.enablementGeneration,
            provider: state.provider,
            model: state.model,
            credentialConfigured: configured,
            consentGranted: state.consent?.status === 'granted',
            categoryModes: state.categoryModes,
            state: unavailable
              ? 'unavailable'
              : !state.enabled
                ? 'disabled'
                : !configured
                  ? 'needs_setup'
                  : count.attempts >= state.dailyRequestLimit
                    ? 'limited'
                    : 'ready',
            error: unavailable
              ? { code: 'storage_unavailable', retryable: false }
              : null,
            dailyRequestsUsed: count.attempts,
            dailyRequestLimit: state.dailyRequestLimit,
            resetAt: count.resetAt,
            resetTimeZone: count.timeZone,
            sessionHiddenCount: 0,
          });
        });
      },
    },
    /** Coordinator first aborts requests/restores posts, then awaits this reset. */
    clearAll(expectedGeneration?: number) {
      return context.run(async () => {
        const generation = await checkResetGeneration(
          context,
          expectedGeneration,
        );
        const snapshot = {
          settings: createDefaultSettings(),
          enablementGeneration: nextGeneration(generation),
        };
        // Persist a non-secret disabled generation tombstone first. A crash cannot
        // leave a previously enabled configuration or revive old callbacks.
        cache.clear();
        diagnostics.clear();
        // Erase even if the capability has since been revoked. Never fall back to
        // a different credential location. Missing facility has nothing to erase.
        try {
          await context.saveSettings(snapshot);
        } finally {
          if (browser.trustedSessionStorage)
            await browser.trustedSessionStorage.clear();
        }
        await context.local.remove(USAGE_KEY);
        await context.local.remove(MIGRATION_BACKUP_KEY);
        return snapshot;
      }, true);
    },
    disconnect(provider: ProviderId, expectedGeneration?: number) {
      if (!ProviderIdSchema.safeParse(provider).success)
        return Promise.reject(new StorageError('invalid_request'));
      const selected = provider;
      return context.run(async () => {
        const generation = await checkResetGeneration(
          context,
          expectedGeneration,
        );
        try {
          const previous = await context.readSettings();
          const snapshot = {
            settings:
              previous.settings.provider === selected
                ? {
                    ...previous.settings,
                    enabled: false,
                    provider: null,
                    model: null,
                    consent: null,
                  }
                : previous.settings,
            enablementGeneration: nextGeneration(generation),
          };
          await context.saveSettings(snapshot);
          // Billing reservations survive disconnect/reconnect; they are not refunds.
          return snapshot;
        } finally {
          cache.clear();
          diagnostics.clear();
          if (browser.trustedSessionStorage)
            await browser.trustedSessionStorage.remove(
              `clearedin.credential.${selected}`,
            );
        }
      }, true);
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;
