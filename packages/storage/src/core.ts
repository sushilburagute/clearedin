import {
  GenerationSchema,
  SettingsSchema,
  createDefaultSettings,
  type ErrorCode,
  type KeyValueStore,
  type Settings,
  type SettingsSnapshot,
} from '@clearedin/contracts';

export const SETTINGS_KEY = 'clearedin.settings';
export const MIGRATION_BACKUP_KEY = 'clearedin.settings.migration';
export const USAGE_KEY = 'clearedin.usage';

/** Safe codes only: never forward browser errors or validation payloads to UI. */
export class StorageError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'StorageError';
  }
}

export function object(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StorageError('unsupported_schema');
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) {
    throw new StorageError('unsupported_schema');
  }
  return record;
}

export function parseSettings(value: unknown): Settings {
  const result = SettingsSchema.safeParse(value);
  if (!result.success) throw new StorageError('invalid_request');
  return result.data;
}

/** Only the explicitly documented v0 shape is supported, never guessed aliases. */
export function migrateSettings(value: unknown): Settings {
  const record = object(value, [
    'schemaVersion',
    'enabled',
    'categoryModes',
    'provider',
    'model',
    'dailyRequestLimit',
    'consent',
    'estimatedCostCap',
    'languages',
  ]);
  if (record.schemaVersion === 1) return parseSettings(value);
  if (record.schemaVersion !== 0) throw new StorageError('unsupported_schema');
  // Validate all legacy fields before producing or backing up any configuration.
  object(value, [
    'schemaVersion',
    'enabled',
    'categoryModes',
    'provider',
    'model',
    'dailyRequestLimit',
    'consent',
  ]);
  return parseSettings({
    ...record,
    schemaVersion: 1,
    estimatedCostCap: null,
    languages: ['en'],
  });
}

export interface StorageContext {
  local: KeyValueStore;
  run<T>(operation: () => Promise<T>, recovery?: boolean): Promise<T>;
  readSettings(): Promise<SettingsSnapshot>;
  saveSettings(snapshot: SettingsSnapshot): Promise<void>;
  checkGeneration(expected: number): Promise<SettingsSnapshot>;
}

// Multiple facades in one worker share the same queue. Task 11 remains the sole
// production writer; this is not a cross-process/browser-storage transaction.
const contexts = new WeakMap<KeyValueStore, StorageContext>();

export function storageContext(local: KeyValueStore): StorageContext {
  const existing = contexts.get(local);
  if (existing) return existing;
  let tail: Promise<unknown> = Promise.resolve();
  let poisoned = false;
  const context: StorageContext = {
    local,
    run<T>(operation: () => Promise<T>, recovery = false): Promise<T> {
      const result = tail.then(async () => {
        if (poisoned && !recovery)
          throw new StorageError('storage_unavailable');
        try {
          const value = await operation();
          if (recovery) poisoned = false;
          return value;
        } catch (error) {
          if (error instanceof StorageError) throw error;
          // A rejected browser write may have committed. Do not issue another
          // request on ambiguous durable state until explicit deletion recovery
          // succeeds or the worker is reconstructed.
          poisoned = true;
          throw new StorageError('storage_unavailable');
        }
      });
      tail = result.catch(() => undefined);
      return result;
    },
    async readSettings() {
      const raw = await local.get(SETTINGS_KEY);
      if (raw === undefined || raw === null) {
        return { settings: createDefaultSettings(), enablementGeneration: 0 };
      }
      const envelope = object(raw, [
        'schemaVersion',
        'enablementGeneration',
        'settings',
      ]);
      if (
        envelope.schemaVersion !== 1 ||
        !GenerationSchema.safeParse(envelope.enablementGeneration).success
      ) {
        throw new StorageError('unsupported_schema');
      }
      const settings = migrateSettings(envelope.settings);
      const snapshot = {
        settings,
        enablementGeneration: envelope.enablementGeneration as number,
      };
      const version = (envelope.settings as Record<string, unknown>)
        .schemaVersion;
      if (version === 0) {
        // Backup has been validated as a non-secret settings shape.
        await local.set(MIGRATION_BACKUP_KEY, envelope.settings);
        await context.saveSettings(snapshot);
        await local.remove(MIGRATION_BACKUP_KEY);
      } else if ((await local.get(MIGRATION_BACKUP_KEY)) !== undefined) {
        // Recover a crash between committing migrated settings and deleting the
        // validated backup. Never copy an old backup over the committed record.
        await local.remove(MIGRATION_BACKUP_KEY);
      }
      return snapshot;
    },
    async saveSettings(snapshot) {
      await local.set(SETTINGS_KEY, {
        schemaVersion: 1,
        enablementGeneration: snapshot.enablementGeneration,
        settings: parseSettings(snapshot.settings),
      });
    },
    async checkGeneration(expected) {
      if (!GenerationSchema.safeParse(expected).success)
        throw new StorageError('invalid_request');
      const snapshot = await context.readSettings();
      if (snapshot.enablementGeneration !== expected)
        throw new StorageError('cancelled');
      return snapshot;
    },
  };
  contexts.set(local, context);
  return context;
}

export function nextGeneration(current: number): number {
  if (current >= Number.MAX_SAFE_INTEGER)
    throw new StorageError('storage_unavailable');
  return current + 1;
}

/** Explicit user reset may erase incompatible data; ordinary reads never do. */
export async function checkResetGeneration(
  context: StorageContext,
  expected: number,
): Promise<void> {
  if (!GenerationSchema.safeParse(expected).success)
    throw new StorageError('invalid_request');
  const raw = await context.local.get(SETTINGS_KEY);
  const stored =
    raw && typeof raw === 'object' && 'enablementGeneration' in raw
      ? raw.enablementGeneration
      : 0;
  if (!GenerationSchema.safeParse(stored).success || stored !== expected)
    throw new StorageError('cancelled');
}
