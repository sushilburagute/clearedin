import { CATEGORY_IDS, type ThresholdProfile } from '@clearedin/contracts';
import { describe, expect, it } from 'vitest';
import {
  createExperimentalThresholdProfile,
  defineThresholdProfile,
  EVALUATED_THRESHOLD_PROFILES,
  selectThresholdProfile,
} from '../src/index';

describe('threshold configuration', () => {
  it('ships no purportedly evaluated release configurations', () => {
    expect(EVALUATED_THRESHOLD_PROFILES).toEqual([]);
    expect(
      selectThresholdProfile(EVALUATED_THRESHOLD_PROFILES, 'openai', 'model'),
    ).toBeNull();
  });

  it('creates independent deeply frozen profiles with every stable category', () => {
    const pair = { hide: 0.95, protect: 0.8 };
    const profile = createExperimentalThresholdProfile('openai', 'model', {
      referral: pair,
    });
    pair.hide = 0.1;
    expect(profile.categories.referral?.hide).toBe(0.95);
    expect(Object.keys(profile.categories)).toEqual(CATEGORY_IDS);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.categories)).toBe(true);
    expect(Object.values(profile.categories).every(Object.isFrozen)).toBe(true);
  });

  it.each([NaN, Infinity, -0.1, 1.1])('rejects invalid score %s', (hide) => {
    expect(() =>
      createExperimentalThresholdProfile('openai', 'model', {
        referral: { hide, protect: 0.7 },
      }),
    ).toThrow();
  });

  it('rejects missing and extra keys rather than silently applying defaults', () => {
    const profile = structuredClone(
      createExperimentalThresholdProfile('openai', 'model'),
    );
    delete (profile.categories as Partial<Record<string, unknown>>).event;
    expect(() => defineThresholdProfile(profile)).toThrow();
    expect(() =>
      defineThresholdProfile({ ...profile, extra: true } as ThresholdProfile),
    ).toThrow();
    expect(() =>
      createExperimentalThresholdProfile('openai', 'model', {
        other: null,
      } as never),
    ).toThrow();
    expect(() =>
      createExperimentalThresholdProfile('openai', 'model', {
        referral: undefined,
      } as never),
    ).toThrow();
  });

  it('selects exact provider and model, with experimental opt-in', () => {
    const profile = createExperimentalThresholdProfile('openai', 'model');
    expect(selectThresholdProfile([profile], 'openai', 'model')).toBeNull();
    expect(
      selectThresholdProfile([profile], 'openai', 'model', {
        allowExperimental: true,
      }),
    ).toEqual(profile);
    expect(
      selectThresholdProfile([profile], 'anthropic', 'model', {
        allowExperimental: true,
      }),
    ).toBeNull();
    expect(
      selectThresholdProfile([profile], 'openai', 'other', {
        allowExperimental: true,
      }),
    ).toBeNull();
  });

  it('rejects ambiguous configurations', () => {
    const profile = createExperimentalThresholdProfile('openai', 'model');
    expect(() =>
      selectThresholdProfile([profile, profile], 'openai', 'model', {
        allowExperimental: true,
      }),
    ).toThrow('Ambiguous');
  });
});
