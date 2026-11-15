import { describe, expect, it } from 'vitest';
import { POLICY_FIXTURES, createPolicyInput } from '../src/policy/index';

describe('synthetic policy cases', () => {
  it('ships uniquely identified, immutable overlap and adversarial examples', () => {
    expect(new Set(POLICY_FIXTURES.map(({ id }) => id)).size).toBe(
      POLICY_FIXTURES.length,
    );
    expect(POLICY_FIXTURES.length).toBeGreaterThanOrEqual(14);
    expect(Object.isFrozen(POLICY_FIXTURES)).toBe(true);
    for (const fixture of POLICY_FIXTURES) {
      expect(fixture.text).toMatch(/^\[Synthetic\]/);
      expect(Object.isFrozen(fixture.input.categoryModes)).toBe(true);
      expect(fixture.input.thresholds?.validation).not.toBe('evaluated');
    }
    expect(
      POLICY_FIXTURES.some(({ id }) => id === 'abstention-high-score'),
    ).toBe(true);
    expect(
      POLICY_FIXTURES.some(({ id }) => id === 'injection-is-content'),
    ).toBe(true);
  });

  it('returns independent policy input defaults for callers', () => {
    const first = createPolicyInput();
    const second = createPolicyInput();
    expect(first).toEqual(second);
    expect(first.categoryModes).not.toBe(second.categoryModes);
    expect(first.classification).not.toBe(second.classification);
    expect(first.thresholds).not.toBe(second.thresholds);
  });
});
