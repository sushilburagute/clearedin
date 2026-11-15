import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultSettings,
  PublicStatusSchema,
} from '@clearedin/contracts';
import {
  MIGRATION_BACKUP_KEY,
  SETTINGS_KEY,
  USAGE_KEY,
  createStorage,
  prepareTrustedSessionStorage,
} from '../src';
import { attempt, harness } from './helpers';

describe('trusted session credentials and reset', () => {
  it('permits explicit clear after ambiguous failures, even while local writes still fail', async () => {
    const fixture = harness();
    await fixture.storage.credentials.set('openai', 'dummy', 0);
    fixture.local.failWrite = true;
    await expect(
      fixture.storage.usage.reserve(attempt('ambiguous')),
    ).rejects.toThrow('storage_unavailable');
    await expect(fixture.storage.clearAll(0)).rejects.toThrow(
      'storage_unavailable',
    );
    expect(fixture.session.values.size).toBe(0);
    fixture.local.failWrite = false;
    await fixture.storage.clearAll(0);
    expect((await fixture.storage.settings.read()).enablementGeneration).toBe(
      1,
    );
  });
  it('permits disconnect after a recovered storage failure', async () => {
    const fixture = harness();
    await fixture.storage.credentials.set('openai', 'dummy', 0);
    fixture.local.failWrite = true;
    await expect(
      fixture.storage.usage.reserve(attempt('ambiguous')),
    ).rejects.toThrow('storage_unavailable');
    fixture.local.failWrite = false;
    await fixture.storage.disconnect('openai', 0);
    expect(fixture.session.values.size).toBe(0);
    expect((await fixture.storage.settings.read()).enablementGeneration).toBe(
      1,
    );
  });
  it('allows authorized deletion of incompatible schemas without accepting their data', async () => {
    const fixture = harness();
    await fixture.storage.credentials.set('openai', 'dummy', 0);
    await fixture.local.set(SETTINGS_KEY, {
      schemaVersion: 2,
      enablementGeneration: 7,
      settings: { schemaVersion: 2 },
    });
    await expect(fixture.storage.clearAll(0)).rejects.toThrow('cancelled');
    expect(fixture.session.values.size).toBe(1);
    const status = await fixture.storage.public.readStatus();
    expect(status.enablementGeneration).toBe(7);
    expect(status.enabled).toBe(false);
    await fixture.storage.clearAll(7);
    expect(fixture.session.values.size).toBe(0);
    expect((await fixture.storage.settings.read()).enablementGeneration).toBe(
      8,
    );
  });
  it('keeps public status consistent with reset queued during its read', async () => {
    const { storage } = harness();
    const selected = await storage.settings.write(
      { ...createDefaultSettings(), provider: 'openai', model: 'synthetic' },
      0,
    );
    await storage.credentials.set(
      'openai',
      'dummy',
      selected.enablementGeneration,
    );
    await storage.usage.reserve(
      attempt('before', { expectedGeneration: selected.enablementGeneration }),
    );
    const [status, reset] = await Promise.all([
      storage.public.readStatus(),
      storage.clearAll(selected.enablementGeneration),
    ]);
    expect(status.enablementGeneration).toBe(selected.enablementGeneration);
    expect(status.credentialConfigured).toBe(true);
    expect(status.dailyRequestsUsed).toBe(1);
    expect(reset.enablementGeneration).toBe(selected.enablementGeneration + 1);
    expect((await storage.public.readStatus()).provider).toBeNull();
  });
  it('keeps credentials separate and survives worker recreation with the same browser session', async () => {
    const fixture = harness();
    await fixture.storage.credentials.set('openai', 'dummy-session-value', 0);
    expect(await fixture.restart().credentials.get('openai')).toBe(
      'dummy-session-value',
    );
    expect(JSON.stringify([...fixture.local.values])).not.toContain(
      'dummy-session-value',
    );
    expect(await fixture.storage.public.readSettings()).toEqual(
      createDefaultSettings(),
    );
    await fixture.session.clear(); // Models session end, not live browser evidence.
    expect(await fixture.restart().credentials.get('openai')).toBeNull();
  });
  it('returns only a boolean credential status, never secret fields', async () => {
    const { storage } = harness();
    const snapshot = await storage.settings.write(
      { ...createDefaultSettings(), provider: 'openai', model: 'synthetic' },
      0,
    );
    await storage.credentials.set(
      'openai',
      'dummy-session-value',
      snapshot.enablementGeneration,
    );
    const status = await storage.public.readStatus();
    expect(PublicStatusSchema.safeParse(status).success).toBe(true);
    expect(status.credentialConfigured).toBe(true);
    expect(JSON.stringify(status)).not.toContain('dummy-session-value');
  });
  it.each([
    'trustedSessionStorage',
    'sessionSurvivesBackgroundRestart',
  ] as const)(
    'fails closed without %s and never writes to local',
    async (capability) => {
      const fixture = harness();
      fixture.browser.capabilities[capability] = false;
      await expect(
        fixture.storage.credentials.set('openai', 'dummy', 0),
      ).rejects.toThrow('storage_unavailable');
      await expect(fixture.storage.credentials.get('openai')).rejects.toThrow(
        'storage_unavailable',
      );
      expect(fixture.local.values.size).toBe(0);
      expect(fixture.session.values.size).toBe(0);
    },
  );
  it('fails closed on absent session facility', async () => {
    const fixture = harness();
    fixture.browser.trustedSessionStorage = null;
    await expect(fixture.storage.credentials.get('openai')).rejects.toThrow(
      'storage_unavailable',
    );
  });
  it('awaits Chrome isolation before returning a usable storage port', async () => {
    const access: string[] = [];
    const area = {
      get: vi.fn(async () => ({ sample: 'dummy' })),
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      clear: vi.fn(async () => undefined),
      setAccessLevel: vi.fn(async (options: { accessLevel: string }) => {
        access.push(options.accessLevel);
      }),
    };
    const port = await prepareTrustedSessionStorage({ family: 'chrome', area });
    expect(access).toEqual(['TRUSTED_CONTEXTS']);
    expect(area.get).not.toHaveBeenCalled();
    expect(await port?.get('sample')).toBe('dummy');
    expect(
      await prepareTrustedSessionStorage({
        family: 'chrome',
        area: {
          ...area,
          setAccessLevel: async () => {
            throw new Error('dummy');
          },
        },
      }),
    ).toBeNull();
    const noSetter = {
      get: area.get,
      set: area.set,
      remove: area.remove,
      clear: area.clear,
    };
    expect(
      await prepareTrustedSessionStorage({ family: 'chrome', area: noSetter }),
    ).toBeNull();
    expect(
      await prepareTrustedSessionStorage({ family: 'chrome', area: null }),
    ).toBeNull();
  });
  it('requires explicit accepted Firefox native isolation without emulating Chrome APIs', async () => {
    const setter = vi.fn();
    const area = {
      get: async () => ({}),
      set: async () => undefined,
      remove: async () => undefined,
      clear: async () => undefined,
      setAccessLevel: setter,
    };
    expect(
      await prepareTrustedSessionStorage({ family: 'firefox', area }),
    ).toBeNull();
    expect(
      await prepareTrustedSessionStorage({
        family: 'firefox',
        area,
        nativeIsolationVerified: true,
      }),
    ).not.toBeNull();
    expect(setter).not.toHaveBeenCalled();
  });
  it('disconnect disables the selected provider and erases its credential while retaining billing attempts', async () => {
    const { storage, session } = harness();
    await storage.credentials.set('openai', 'dummy', 0);
    await storage.usage.reserve(attempt('charged'));
    const selected = await storage.settings.write(
      { ...createDefaultSettings(), provider: 'openai', model: 'synthetic' },
      0,
    );
    const reset = await storage.disconnect(
      'openai',
      selected.enablementGeneration,
    );
    expect(reset.settings.provider).toBeNull();
    expect(reset.settings.consent).toBeNull();
    expect(reset.settings.enabled).toBe(false);
    expect(session.values.size).toBe(0);
    expect((await storage.usage.read()).attempts).toBe(1);
  });
  it('clear erases credentials, reservations, migration backups and diagnostics, leaving a disabled generation tombstone', async () => {
    const fixture = harness();
    await fixture.storage.credentials.set('openai', 'dummy', 0);
    await fixture.storage.usage.reserve(attempt('old'));
    await fixture.local.set(MIGRATION_BACKUP_KEY, createDefaultSettings());
    fixture.storage.diagnostics.append({ timestamp: 0, code: 'timeout' });
    const reset = await fixture.storage.clearAll(0);
    expect(reset).toEqual({
      settings: createDefaultSettings(),
      enablementGeneration: 1,
    });
    expect([...fixture.local.values.keys()]).toEqual([SETTINGS_KEY]);
    expect(fixture.session.values.size).toBe(0);
    expect(fixture.storage.diagnostics.read()).toEqual([]);
    await expect(
      fixture.storage.credentials.set('openai', 'stale', 0),
    ).rejects.toThrow('cancelled');
    await expect(
      fixture.storage.settings.write(createDefaultSettings(), 0),
    ).rejects.toThrow('cancelled');
    await expect(
      fixture.storage.usage.reconcile(
        'old',
        { estimatedCost: 0, currency: 'USD' },
        0,
      ),
    ).rejects.toThrow('cancelled');
    expect(
      (await fixture.storage.usage.reserve(attempt('late'))).accepted,
    ).toBe(false);
    expect(await fixture.local.get(USAGE_KEY)).toBeUndefined();
    expect((await fixture.restart().settings.read()).enablementGeneration).toBe(
      1,
    );
  });
  it('serializes clear after an in-flight durable reservation then rejects queued stale writes', async () => {
    const fixture = harness();
    const results = await Promise.allSettled([
      fixture.storage.usage.reserve(attempt('in-flight')),
      fixture.storage.clearAll(0),
      fixture.storage.credentials.set('openai', 'stale', 0),
    ]);
    expect(results[0]?.status).toBe('fulfilled');
    expect(results[1]?.status).toBe('fulfilled');
    expect(results[2]?.status).toBe('rejected');
    expect(await fixture.local.get(USAGE_KEY)).toBeUndefined();
    expect(fixture.session.values.size).toBe(0);
  });
  it('can erase stored credentials even after capabilities are revoked', async () => {
    const fixture = harness();
    await fixture.storage.credentials.set('openai', 'dummy', 0);
    fixture.browser.capabilities.trustedSessionStorage = false;
    await fixture.storage.clearAll(0);
    expect(fixture.session.values.size).toBe(0);
    const publicFacade = createStorage({
      browser: fixture.browser,
      clock: fixture.clock,
      timeZone: 'UTC',
    }).public;
    expect(JSON.stringify(await publicFacade.readSettings())).not.toContain(
      'dummy',
    );
  });
});
