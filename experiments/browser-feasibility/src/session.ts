export const SESSION_KEY = '__clearedin_probe_dummy__';
const DUMMY = 'synthetic-only-not-a-provider-key';

export interface SessionArea {
  setAccessLevel?: (input: {
    accessLevel: 'TRUSTED_CONTEXTS';
  }) => Promise<void>;
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

// A fresh instance represents a new background lifetime. No local/sync port exists.
export function createSessionProbe(
  area: SessionArea | undefined,
  family: 'chrome' | 'firefox' = 'chrome',
) {
  const ready = (async () => {
    if (!area) return false;
    // Firefox exposes an inherently privileged-only session area without the
    // Chrome access-level setter. Probe its native default, then require seeded
    // content-world denial evidence before recommending it to task 04.
    if (!area.setAccessLevel) return family === 'firefox';
    try {
      await area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
      return true;
    } catch {
      return false;
    }
  })();
  return {
    ready,
    async configured(): Promise<boolean> {
      if (!(await ready) || !area) return false;
      return (await area.get(SESSION_KEY))[SESSION_KEY] === DUMMY;
    },
    async seed(): Promise<boolean> {
      if (!(await ready) || !area) return false;
      await area.set({ [SESSION_KEY]: DUMMY });
      return true;
    },
    async clear(): Promise<void> {
      if (area) await area.remove(SESSION_KEY);
    },
  };
}
