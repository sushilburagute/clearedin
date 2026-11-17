import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '../../packages/contracts/src/index';
import { EVALUATION_CORPUS } from '../../packages/test-fixtures/src/evaluation/corpus';
import { POLICY_FIXTURES } from '../../packages/test-fixtures/src/policy/index';
import { createVisibilityEvaluator } from '../../packages/decision-engine/src/index';
import { assessQuality, summarize, type Observation } from './observation-metrics';
const sample: Observation = {
  expectedHidden: true,
  hidden: true,
  expectedLabels: ['engagement_bait'],
  predictedLabels: ['engagement_bait'],
  clear: true,
  abstained: false,
  latencyMs: 10,
  attempts: 1,
  cost: null,
};
describe('evaluation corpus integrity', () => {
  it('retains 540 provisional examples, balanced categories and disjoint template splits', () => {
    expect(EVALUATION_CORPUS).toHaveLength(540);
    expect(new Set(EVALUATION_CORPUS.map((row) => row.id)).size).toBe(540);
    const dev = new Set(
      EVALUATION_CORPUS.filter((row) => row.split === 'development').map(
        (row) => row.template,
      ),
    );
    const heldout = EVALUATION_CORPUS.filter((row) => row.split === 'heldout');
    expect(heldout).toHaveLength(270);
    expect(heldout.every((row) => !dev.has(row.template))).toBe(true);
    for (const id of CATEGORY_IDS)
      expect(
        EVALUATION_CORPUS.filter((row) => row.labels.includes(id)).length,
      ).toBeGreaterThanOrEqual(30);
    expect(
      EVALUATION_CORPUS.every(
        (row) => row.annotation === 'generated-unreviewed',
      ),
    ).toBe(true);
  });
  it('replays independent expected policy outcomes including protect and abstention', () => {
    const evaluate = createVisibilityEvaluator({ allowExperimental: true });
    for (const fixture of POLICY_FIXTURES)
      expect(evaluate(fixture.input), fixture.id).toEqual(fixture.expected);
  });
});
describe('measurement accounting', () => {
  it('does not pass zero hides, empty samples, or synthetic perfect outputs', () => {
    expect(summarize([]).precision.value).toBeNull();
    expect(assessQuality(summarize([]), [], 'adjudicated-live')).toBe(
      'pending',
    );
    const report = summarize([{ ...sample, hidden: false, abstained: true }]);
    expect(report.precision.value).toBeNull();
    expect(report.coverage.value).toBe(0);
    expect(
      assessQuality(summarize([sample]), ['engagement_bait'], 'synthetic'),
    ).toBe('pending');
  });
  it('uses expected-visible denominator and accounts for retry costs and unknown costs', () => {
    const report = summarize([
      sample,
      { ...sample, expectedHidden: false, attempts: 2, cost: 0.03 },
    ]);
    expect(report.precision.value).toBe(0.5);
    expect(report.falseHides.value).toBe(1);
    expect(report.attempts).toBe(3);
    expect(report.costPer100Attempts).toBeNull();
    expect(
      summarize([{ ...sample, cost: 0.03, attempts: 3 }]).costPer100Attempts,
    ).toBe(1);
    expect(report.recall.job_posting?.value).toBeNull();
  });
  it('requires confidence bounds and adequate positive evidence', () => {
    expect(
      assessQuality(
        summarize([sample]),
        ['engagement_bait'],
        'adjudicated-live',
      ),
    ).toBe('pending');
    const rows = [
      ...Array.from({ length: 200 }, () => sample),
      ...Array.from({ length: 200 }, () => ({
        ...sample,
        hidden: false,
        expectedHidden: false,
      })),
    ];
    expect(
      assessQuality(summarize(rows), ['engagement_bait'], 'adjudicated-live'),
    ).toBe('passed');
    expect(
      assessQuality(summarize(rows), ['job_posting'], 'adjudicated-live'),
    ).toBe('pending');
  });
  it('rejects invalid measurements', () => {
    expect(() => summarize([{ ...sample, latencyMs: NaN }])).toThrow();
    expect(() => summarize([{ ...sample, attempts: -1 }])).toThrow();
  });
});
