import { ClassificationResultSchema } from '@clearedin/contracts';
import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_FIXTURES,
  SYNTHETIC_MODEL,
  createSyntheticClassifier,
  createSyntheticInput,
  type SyntheticFixtureId,
} from '../src/fake-classifier/index';

const context = () => ({ signal: new AbortController().signal });

describe('synthetic classifier', () => {
  it('returns deterministic schema-valid fixtures without a provider connection', async () => {
    const classifier = createSyntheticClassifier();
    expect(classifier.mode).toBe('synthetic-fixtures-only');
    for (const fixture of SYNTHETIC_FIXTURES) {
      const input = createSyntheticInput(fixture.id as SyntheticFixtureId);
      const first = await classifier.classify(input, context());
      const second = await classifier.classify(input, context());
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(ClassificationResultSchema.safeParse(first).success).toBe(true);
      expect(first.model).toBe(SYNTHETIC_MODEL);
      expect(first.requestId).toBe(input.requestId);
      expect(
        first.categories.some((entry) => (entry.id as string) === 'sponsored'),
      ).toBe(false);
    }
  });

  it('keeps overlapping categories and returns no hiding evidence for abstention', async () => {
    const classifier = createSyntheticClassifier();
    const overlap = await classifier.classify(
      createSyntheticInput('job-referral'),
      context(),
    );
    expect(overlap.categories.map((entry) => entry.id)).toEqual([
      'job_posting',
      'referral',
    ]);
    for (const id of [
      'ambiguous',
      'partial',
      'unsupported-language',
      'refused',
    ] as const) {
      const result = await classifier.classify(
        createSyntheticInput(id),
        context(),
      );
      expect(result.sufficiency).toBe('insufficient');
      expect(result.categories).toEqual([]);
      expect(result.abstention).not.toBeNull();
    }
  });

  it('rejects arbitrary text, changed completeness, and unsupported fixture versions', async () => {
    const classifier = createSyntheticClassifier();
    const input = createSyntheticInput('technical-launch');
    await expect(
      classifier.classify({ ...input, text: 'An actual post' }, context()),
    ).rejects.toThrow('Only exact synthetic fixtures');
    await expect(
      classifier.classify({ ...input, extraction: 'partial' }, context()),
    ).rejects.toThrow('Only exact synthetic fixtures');
    await expect(
      classifier.classify({ ...input, promptVersion: 'different' }, context()),
    ).rejects.toThrow('versions do not match');
  });

  it('does not accept credential-bearing context', async () => {
    const classifier = createSyntheticClassifier();
    const forbiddenContext = {
      ...context(),
      credential: 'synthetic-placeholder',
    };
    await expect(
      classifier.classify(createSyntheticInput('other'), forbiddenContext),
    ).rejects.toThrow('accepts only an abort signal');
  });

  it('honors cancellation before dispatch and before delivery', async () => {
    const classifier = createSyntheticClassifier();
    const before = new AbortController();
    before.abort(new Error('cancel-before'));
    await expect(
      classifier.classify(createSyntheticInput('other'), {
        signal: before.signal,
      }),
    ).rejects.toThrow('cancel-before');

    const during = new AbortController();
    const result = classifier.classify(createSyntheticInput('other'), {
      signal: during.signal,
    });
    during.abort(new Error('cancel-during'));
    await expect(result).rejects.toThrow('cancel-during');
  });

  it('cannot mutate later results through previously returned data', async () => {
    const classifier = createSyntheticClassifier();
    const input = createSyntheticInput('job-referral');
    const first = await classifier.classify(input, context());
    first.categories.length = 0;
    const second = await classifier.classify(input, context());
    expect(second.categories).toHaveLength(2);
  });
});
