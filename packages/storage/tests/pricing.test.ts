import { expect, it } from 'vitest';
import { estimateKnownCost, type KnownPricing } from '../src';

const price: KnownPricing = {
  provider: 'openai',
  model: 'synthetic',
  version: 'fixture-v1',
  verifiedOn: '2026-11-16',
  currency: 'USD',
  perInputToken: 0.001,
  perOutputToken: 0.002,
};
it('uses explicit verified token or question units and needs all priced bounds', () => {
  expect(
    estimateKnownCost(price, { inputTokens: 100, outputTokens: 50 }),
  ).toEqual({ amount: 0.2, currency: 'USD' });
  expect(estimateKnownCost(price, { inputTokens: 100 })).toBeNull();
  expect(
    estimateKnownCost(
      { ...price, perInputToken: 0, perOutputToken: 0, perQuestion: 0.01 },
      { inputTokens: 0, outputTokens: 0, questions: 12 },
    ),
  ).toEqual({ amount: 0.12, currency: 'USD' });
});
it('keeps unknown cost unavailable and validates billing metadata and bounds', () => {
  expect(estimateKnownCost(null, {})).toBeNull();
  expect(() =>
    estimateKnownCost({ ...price, perInputToken: -1 }, { inputTokens: 1 }),
  ).toThrow('invalid_request');
  expect(() => estimateKnownCost(price, { inputTokens: Infinity })).toThrow(
    'invalid_request',
  );
  expect(() =>
    estimateKnownCost({ ...price, verifiedOn: 'unknown' }, {}),
  ).toThrow('invalid_request');
});
