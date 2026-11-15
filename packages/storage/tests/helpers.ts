import { type BrowserPorts, type KeyValueStore } from '@clearedin/contracts';
import { createStorage } from '../src';

export class MemoryStore implements KeyValueStore {
  failWrite = false;
  constructor(readonly values = new Map<string, unknown>()) {}
  async get(key: string) {
    return structuredClone(this.values.get(key));
  }
  async set(key: string, value: unknown) {
    if (this.failWrite) throw new Error('dummy private browser failure');
    this.values.set(key, structuredClone(value));
  }
  async remove(key: string) {
    this.values.delete(key);
  }
  async clear() {
    this.values.clear();
  }
}
export function harness(timeZone = 'UTC') {
  const local = new MemoryStore();
  const session = new MemoryStore();
  let now = Date.parse('2026-11-16T12:00:00Z');
  const browser: BrowserPorts = {
    capabilities: {
      family: 'chrome',
      trustedSessionStorage: true,
      sessionSurvivesBackgroundRestart: true,
    },
    localStorage: local,
    trustedSessionStorage: session,
    hasProviderPermission: async () => true,
    requestProviderPermission: async () => true,
    broadcast: async () => undefined,
  };
  const clock = { now: () => now };
  return {
    local,
    session,
    browser,
    clock,
    storage: createStorage({ browser, clock, timeZone }),
    setNow: (value: string) => {
      now = Date.parse(value);
    },
    restart: () =>
      createStorage({
        browser: { ...browser, localStorage: new MemoryStore(local.values) },
        clock,
        timeZone,
      }),
  };
}
export function attempt(
  requestId: string,
  options: Partial<
    Parameters<ReturnType<typeof createStorage>['usage']['reserve']>[0]
  > = {},
) {
  return {
    requestId,
    provider: 'openai' as const,
    expectedGeneration: 0,
    dailyRequestLimit: 2,
    estimatedCostCap: null,
    requestCostEstimate: null,
    ...options,
  };
}
