import {
  BroadcastMessageSchema,
  ProviderIdSchema,
  type BrowserCapabilities,
  type BrowserPorts,
  type BroadcastMessage,
  type Clock,
  type KeyValueStore,
  type ProviderId,
} from '@clearedin/contracts';

export interface StorageBrowserFixtureOptions {
  /** Epoch milliseconds; defaults to 2026-01-01 00:00:00 UTC. */
  now?: number;
  family?: BrowserCapabilities['family'];
  trustedSessionStorage?: boolean;
  sessionSurvivesBackgroundRestart?: boolean;
}

export interface StorageBrowserFixture {
  readonly ports: BrowserPorts;
  readonly clock: Clock;
  /** Runs scheduled callbacks in deadline/insertion order, without real timers. */
  advance(milliseconds: number): void;
  /** Forward movement runs timers; backward movement models wall-clock rollback. */
  setTime(timestamp: number): void;
  /** New wrappers over the same fixture-owned browser stores; drops worker timers. */
  restartBackground(): BrowserPorts;
  /** Retains local data and permission choices; clears browser-session data/timers. */
  endBrowserSession(): BrowserPorts;
  /** Simulates permission choices; requestProviderPermission never prompts. */
  setProviderPermission(provider: ProviderId, granted: boolean): void;
  snapshot(): {
    local: Record<string, unknown>;
    session: Record<string, unknown>;
    broadcasts: BroadcastMessage[];
  };
}

function timestamp(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('Invalid fixture timestamp.');
  }
  return value;
}

function memoryPort(values: Map<string, unknown>): KeyValueStore {
  return {
    async get(key) {
      return structuredClone(values.get(key));
    },
    async set(key, value) {
      values.set(key, structuredClone(value));
    },
    async remove(key) {
      values.delete(key);
    },
    async clear() {
      values.clear();
    },
  };
}

/**
 * Synthetic browser/clock fixture, never an isolation or persistence guarantee.
 * "Durable" here means the local Map outlives recreated background wrappers in
 * this fixture only. Both stores disappear when the fixture is released. There
 * is no browser API, sync area, disk, network, or real credential dependency.
 */
export function createStorageBrowserFixture({
  now = Date.UTC(2026, 0, 1),
  family = 'chrome',
  trustedSessionStorage = true,
  sessionSurvivesBackgroundRestart = true,
}: StorageBrowserFixtureOptions = {}): StorageBrowserFixture {
  let currentTime = timestamp(now);
  let sequence = 0;
  const local = new Map<string, unknown>();
  const session = new Map<string, unknown>();
  const broadcasts: BroadcastMessage[] = [];
  const permissions = new Set<ProviderId>();
  const timers = new Map<number, { at: number; callback: () => void }>();

  function ports(): BrowserPorts {
    return {
      capabilities: {
        family,
        trustedSessionStorage,
        sessionSurvivesBackgroundRestart,
      },
      localStorage: memoryPort(local),
      trustedSessionStorage: trustedSessionStorage ? memoryPort(session) : null,
      async hasProviderPermission(provider) {
        return permissions.has(ProviderIdSchema.parse(provider));
      },
      async requestProviderPermission(provider) {
        return permissions.has(ProviderIdSchema.parse(provider));
      },
      async broadcast(event) {
        const parsed = BroadcastMessageSchema.safeParse(event);
        if (!parsed.success) throw new TypeError('Invalid fixture broadcast.');
        broadcasts.push(parsed.data);
      },
    };
  }

  const clock: Clock = {
    now: () => currentTime,
    schedule(callback, delayMs) {
      const at = timestamp(currentTime + timestamp(delayMs));
      const id = sequence++;
      timers.set(id, { at, callback });
      return () => {
        timers.delete(id);
      };
    },
  };

  function advance(milliseconds: number): void {
    const target = timestamp(currentTime + timestamp(milliseconds));
    let executed = 0;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort(
          ([leftId, left], [rightId, right]) =>
            left.at - right.at || leftId - rightId,
        )[0];
      if (!next) break;
      if (++executed > 10_000)
        throw new Error('Fixture timer execution limit exceeded.');
      const [id, timer] = next;
      timers.delete(id);
      currentTime = timer.at;
      timer.callback();
    }
    currentTime = target;
  }

  return {
    ports: ports(),
    clock,
    advance,
    setTime(nextTime) {
      timestamp(nextTime);
      if (nextTime >= currentTime) advance(nextTime - currentTime);
      else currentTime = nextTime;
    },
    restartBackground() {
      timers.clear();
      if (!sessionSurvivesBackgroundRestart) session.clear();
      return ports();
    },
    endBrowserSession() {
      timers.clear();
      session.clear();
      return ports();
    },
    setProviderPermission(provider, granted) {
      ProviderIdSchema.parse(provider);
      if (granted) permissions.add(provider);
      else permissions.delete(provider);
    },
    snapshot() {
      return structuredClone({
        local: Object.fromEntries(local),
        session: Object.fromEntries(session),
        broadcasts,
      });
    },
  };
}
