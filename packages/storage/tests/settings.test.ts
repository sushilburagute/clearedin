import { describe, expect, it } from 'vitest';
import { createDefaultSettings } from '@clearedin/contracts';
import { MIGRATION_BACKUP_KEY, SETTINGS_KEY, migrateSettings } from '../src';
import { harness } from './helpers';

const consent = {
  version: '1',
  provider: 'openai' as const,
  recipientId: 'openai',
  dataClasses: ['post_text' as const, 'classification_instructions' as const],
  timestamp: 1,
  status: 'granted' as const,
};

describe('settings validation and migration', () => {
  it('starts disabled and neutral, returns detached non-secret snapshots', async () => {
    const { storage, local } = harness();
    const read = await storage.settings.read();
    expect(read.settings).toEqual(createDefaultSettings());
    read.settings.categoryModes.referral = 'hide';
    expect(
      (await storage.settings.read()).settings.categoryModes.referral,
    ).toBe('show');
    expect(local.values.size).toBe(0);
  });
  it('validates settings before persistence, rejecting credentials and invalid consent', async () => {
    const { storage, local } = harness();
    expect(() =>
      storage.settings.write(
        { ...createDefaultSettings(), credential: 'dummy' } as never,
        0,
      ),
    ).toThrow('invalid_request');
    expect(() =>
      storage.settings.write({ ...createDefaultSettings(), enabled: true }, 0),
    ).toThrow('invalid_request');
    expect(local.values.size).toBe(0);
  });
  it('changes provider with new consent disabled, then grants consent in a separate write', async () => {
    const { storage } = harness();
    const first = await storage.settings.write(
      {
        ...createDefaultSettings(),
        provider: 'openai',
        model: 'synthetic',
        consent,
        enabled: true,
      },
      0,
    );
    expect(first.settings.consent).toBeNull();
    expect(first.settings.enabled).toBe(false);
    expect(first.enablementGeneration).toBe(1);
    const second = await storage.settings.write(
      { ...first.settings, consent, enabled: true },
      1,
    );
    expect(second.enablementGeneration).toBe(2);
    expect(second.settings.enabled).toBe(true);
    const modes = {
      ...second.settings.categoryModes,
      referral: 'hide' as const,
    };
    const preference = await storage.settings.write(
      { ...second.settings, categoryModes: modes },
      2,
    );
    expect(preference.enablementGeneration).toBe(2);
    expect(preference.settings.categoryModes.referral).toBe('hide');
  });
  it('rejects concurrent obsolete mutations and persists generation across restart', async () => {
    const fixture = harness();
    const [first, second] = await Promise.allSettled([
      fixture.storage.settings.invalidate(0),
      fixture.storage.settings.write(createDefaultSettings(), 0),
    ]);
    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    expect((await fixture.restart().settings.read()).enablementGeneration).toBe(
      1,
    );
  });
  it('migrates the explicit legacy shape without changing category intent', async () => {
    const { storage, local } = harness();
    const defaults = createDefaultSettings();
    const legacy = {
      schemaVersion: 0,
      enabled: defaults.enabled,
      categoryModes: defaults.categoryModes,
      provider: defaults.provider,
      model: defaults.model,
      dailyRequestLimit: defaults.dailyRequestLimit,
      consent: defaults.consent,
    };
    legacy.categoryModes.job_posting = 'always_show';
    legacy.categoryModes.referral = 'hide';
    await local.set(SETTINGS_KEY, {
      schemaVersion: 1,
      enablementGeneration: 4,
      settings: { ...legacy, schemaVersion: 0 },
    });
    const migrated = await storage.settings.read();
    expect(migrated.settings.categoryModes).toEqual(legacy.categoryModes);
    expect(migrated.settings.languages).toEqual(['en']);
    expect(migrated.settings.estimatedCostCap).toBeNull();
    expect(migrated.enablementGeneration).toBe(4);
    expect(await local.get(MIGRATION_BACKUP_KEY)).toBeUndefined();
    expect(
      (
        (await local.get(SETTINGS_KEY)) as {
          settings: { schemaVersion: number };
        }
      ).settings.schemaVersion,
    ).toBe(1);
  });
  it('does not persist a backup from an invalid or credential-bearing legacy record', async () => {
    expect(() =>
      migrateSettings({ schemaVersion: 0, credential: 'dummy' }),
    ).toThrow();
    const { storage, local } = harness();
    await local.set(SETTINGS_KEY, {
      schemaVersion: 1,
      enablementGeneration: 0,
      settings: {
        ...createDefaultSettings(),
        schemaVersion: 0,
        credential: 'dummy',
      },
    });
    await expect(storage.settings.read()).rejects.toThrow();
    expect(await local.get(MIGRATION_BACKUP_KEY)).toBeUndefined();
  });
  it('fails closed on future schemas and never overwrites the record', async () => {
    const { storage, local } = harness();
    const future = { schemaVersion: 2, privateFutureData: 'preserve' };
    await local.set(SETTINGS_KEY, future);
    await expect(storage.settings.read()).rejects.toThrow('unsupported_schema');
    await expect(storage.settings.clear(0)).rejects.toThrow(
      'unsupported_schema',
    );
    expect(await local.get(SETTINGS_KEY)).toEqual(future);
    expect((await storage.public.readStatus()).error?.code).toBe(
      'unsupported_schema',
    );
    expect((await storage.public.readStatus()).enabled).toBe(false);
    expect(await local.get(SETTINGS_KEY)).toEqual(future);
  });
  it('removes a leftover migration backup after restart without restoring it', async () => {
    const fixture = harness();
    const settings = createDefaultSettings();
    settings.categoryModes.referral = 'hide';
    await fixture.local.set(SETTINGS_KEY, {
      schemaVersion: 1,
      enablementGeneration: 3,
      settings,
    });
    await fixture.local.set(MIGRATION_BACKUP_KEY, {
      ...createDefaultSettings(),
      schemaVersion: 0,
    });
    expect(
      (await fixture.restart().settings.read()).settings.categoryModes.referral,
    ).toBe('hide');
    expect(await fixture.local.get(MIGRATION_BACKUP_KEY)).toBeUndefined();
  });
});
