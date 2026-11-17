import { describe, expect, it, vi } from 'vitest';
import type { ProviderId } from '@clearedin/contracts';
import { PROVIDER_REGISTRY, createProviderAdapter } from '../src/registry';

describe('provider registry', () => {
  it('keeps every unverified production configuration unavailable', () => {
    expect(Object.keys(PROVIDER_REGISTRY)).toEqual([
      'typesafe',
      'openai',
      'anthropic',
    ]);
    for (const entry of Object.values(PROVIDER_REGISTRY)) {
      expect(entry.available).toBe(false);
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(new URL(entry.endpoint).protocol).toBe('https:');
    }
  });
  it('constructs only the explicitly selected adapter and performs no eager requests', () => {
    const fetch = vi.fn();
    for (const provider of Object.keys(PROVIDER_REGISTRY) as ProviderId[])
      expect(createProviderAdapter(provider, { fetch }).id).toBe(provider);
    expect(() =>
      createProviderAdapter('unknown' as ProviderId, { fetch }),
    ).toThrow('unsupported_provider');
    expect(fetch).not.toHaveBeenCalled();
  });
});
