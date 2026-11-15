import {
  createDefaultSettings,
  type SettingsStore,
  type SettingsSnapshot,
} from '@clearedin/contracts';
import {
  MIGRATION_BACKUP_KEY,
  nextGeneration,
  parseSettings,
  type StorageContext,
} from './core';

export function createSettingsStore(context: StorageContext): SettingsStore {
  return {
    read: () => context.run(() => context.readSettings()),
    write(settings, expectedGeneration) {
      // Parse/copy at invocation so caller mutation cannot race queued writes.
      const parsed = parseSettings(settings);
      return context.run(async () => {
        const previous = await context.checkGeneration(expectedGeneration);
        const providerChanged = previous.settings.provider !== parsed.provider;
        const configurationChanged =
          providerChanged || previous.settings.model !== parsed.model;
        if (providerChanged) {
          parsed.consent = null;
          parsed.enabled = false;
        }
        const consentChanged =
          JSON.stringify(previous.settings.consent) !==
          JSON.stringify(parsed.consent);
        const invalidates =
          configurationChanged ||
          consentChanged ||
          previous.settings.enabled !== parsed.enabled;
        const snapshot: SettingsSnapshot = {
          settings: parsed,
          enablementGeneration: invalidates
            ? nextGeneration(expectedGeneration)
            : expectedGeneration,
        };
        await context.saveSettings(snapshot);
        return snapshot;
      });
    },
    invalidate(expectedGeneration) {
      return context.run(async () => {
        const previous = await context.checkGeneration(expectedGeneration);
        const snapshot = {
          settings: { ...previous.settings, enabled: false },
          enablementGeneration: nextGeneration(expectedGeneration),
        };
        await context.saveSettings(snapshot);
        return snapshot;
      });
    },
    clear(expectedGeneration) {
      return context.run(async () => {
        await context.checkGeneration(expectedGeneration);
        const snapshot = {
          settings: createDefaultSettings(),
          enablementGeneration: nextGeneration(expectedGeneration),
        };
        await context.saveSettings(snapshot);
        await context.local.remove(MIGRATION_BACKUP_KEY);
        return snapshot;
      });
    },
  };
}
