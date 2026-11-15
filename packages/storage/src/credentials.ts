import {
  ProviderIdSchema,
  type BrowserPorts,
  type CredentialStore,
  type KeyValueStore,
  type ProviderId,
} from '@clearedin/contracts';
import { StorageError, type StorageContext } from './core';

const key = (provider: ProviderId) => {
  if (!ProviderIdSchema.safeParse(provider).success)
    throw new StorageError('invalid_request');
  return `clearedin.credential.${provider}`;
};

export function createCredentialStore(
  context: StorageContext,
  browser: BrowserPorts,
) {
  function session(): KeyValueStore {
    if (
      !browser.capabilities.trustedSessionStorage ||
      !browser.capabilities.sessionSurvivesBackgroundRestart ||
      !browser.trustedSessionStorage
    ) {
      throw new StorageError('storage_unavailable');
    }
    return browser.trustedSessionStorage;
  }
  async function readCredential(provider: ProviderId): Promise<string | null> {
    const value = await session().get(key(provider));
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || value.length === 0 || value.length > 4096)
      throw new StorageError('storage_unavailable');
    return value;
  }
  const store: CredentialStore = {
    get: (provider) => context.run(() => readCredential(provider)),
    set(provider, credential, expectedGeneration) {
      if (
        typeof credential !== 'string' ||
        credential.length === 0 ||
        credential.length > 4096
      ) {
        return Promise.reject(new StorageError('invalid_credential'));
      }
      return context.run(async () => {
        await context.checkGeneration(expectedGeneration);
        await session().set(key(provider), credential);
      });
    },
    remove: (provider, expectedGeneration) =>
      context.run(async () => {
        await context.checkGeneration(expectedGeneration);
        await session().remove(key(provider));
      }),
    clear: (expectedGeneration) =>
      context.run(async () => {
        await context.checkGeneration(expectedGeneration);
        await session().clear();
      }),
  };
  return { store, readCredential };
}

/** Inject promise-based browser APIs. Never pass an untrusted session area to BrowserPorts. */
export interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  setAccessLevel?(options: { accessLevel: 'TRUSTED_CONTEXTS' }): Promise<void>;
}

export async function prepareTrustedSessionStorage(input: {
  family: 'chrome' | 'firefox';
  area: SessionArea | null;
  /** Accepted native-isolation evidence for this Firefox target, not family detection alone. */
  nativeIsolationVerified?: boolean;
}): Promise<KeyValueStore | null> {
  const area = input.area;
  if (!area) return null;
  try {
    if (input.family === 'chrome') {
      if (!area.setAccessLevel) return null;
      await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    } else if (input.nativeIsolationVerified !== true) return null;
    return {
      get: async (name) => (await area.get(name))[name],
      set: (name, value) => area.set({ [name]: value }),
      remove: (name) => area.remove(name),
      clear: () => area.clear(),
    };
  } catch {
    return null;
  }
}
