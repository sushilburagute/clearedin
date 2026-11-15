import {
  CATEGORY_IDS,
  createDefaultCategoryModes,
  type ClassificationResult,
  type PolicyInput,
  type RemoteCategoryId,
} from '@clearedin/contracts';
import { TAXONOMY_VERSION } from '@clearedin/taxonomy';
import { describe, expect, it } from 'vitest';
import {
  createExperimentalThresholdProfile,
  createVisibilityEvaluator,
  evaluateVisibility,
  VISIBILITY_REASONS,
} from '../src/index';

function evidence(
  ids: readonly RemoteCategoryId[] = ['product_launch', 'technical_content'],
): ClassificationResult {
  return {
    schemaVersion: 1,
    requestId: 'policy-test',
    provider: 'typesafe',
    model: 'test-model',
    adapterVersion: 'test-adapter',
    taxonomyVersion: TAXONOMY_VERSION,
    promptVersion: 'test-prompt',
    sufficiency: 'sufficient',
    abstention: null,
    categories: ids.map((id) => ({
      id,
      score: 0.99,
      scoreKind: 'typed_membership',
    })),
  };
}

function input(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    enabled: true,
    consentGranted: true,
    supportedRoute: true,
    validIdentity: true,
    extractorHealthy: true,
    revealed: false,
    extraction: 'complete',
    localSponsored: false,
    categoryModes: { ...createDefaultCategoryModes(), product_launch: 'hide' },
    classification: evidence(),
    thresholds: createExperimentalThresholdProfile('typesafe', 'test-model'),
    ...overrides,
  };
}

const evaluate = createVisibilityEvaluator({ allowExperimental: true });

describe('visibility policy precedence', () => {
  it.each([
    ['enabled', 'disabled'],
    ['consentGranted', 'consent_required'],
    ['supportedRoute', 'unsupported_route'],
    ['validIdentity', 'stale_identity'],
    ['extractorHealthy', 'extractor_unhealthy'],
  ] as const)(
    'shows when %s is false, including local evidence and reveal',
    (flag, reason) => {
      const post = input({
        [flag]: false,
        localSponsored: true,
        revealed: true,
      });
      post.categoryModes = { ...post.categoryModes, sponsored: 'hide' };
      expect(evaluate(post)).toEqual({
        action: 'show',
        reason,
        matchedCategories: [],
      });
    },
  );

  it('returns the first failed global guard', () => {
    expect(
      evaluate(
        input({ enabled: false, consentGranted: false, validIdentity: false }),
      ).reason,
    ).toBe('disabled');
  });

  it('honors reveal before extraction guards or hiding', () => {
    expect(evaluate(input({ revealed: true, extraction: 'partial' }))).toEqual({
      action: 'show',
      reason: 'revealed',
      matchedCategories: [],
    });
  });

  it('keeps Show normally neutral and re-evaluates the exact same evidence', () => {
    const post = input();
    const classification = post.classification;
    expect(evaluate(post).action).toBe('collapse');
    post.categoryModes = {
      ...post.categoryModes,
      technical_content: 'always_show',
    };
    expect(evaluate(post)).toEqual({
      action: 'show',
      reason: 'protected',
      matchedCategories: ['technical_content'],
    });
    expect(post.classification).toBe(classification);
    post.categoryModes = { ...post.categoryModes, product_launch: 'show' };
    post.categoryModes = { ...post.categoryModes, technical_content: 'show' };
    expect(evaluate(post).reason).toBe('no_matching_rule');
  });

  it('reports all matching reasons in stable taxonomy order', () => {
    const post = input({
      classification: evidence(['referral', 'job_posting', 'promotion']),
      localSponsored: true,
    });
    post.categoryModes = Object.fromEntries(
      CATEGORY_IDS.map((id) => [id, 'hide']),
    ) as PolicyInput['categoryModes'];
    expect(evaluate(post)).toEqual({
      action: 'collapse',
      reason: 'category_hidden',
      matchedCategories: ['job_posting', 'referral', 'promotion', 'sponsored'],
    });
  });

  it('reports all protecting categories and no hiding categories', () => {
    const post = input({ localSponsored: true });
    post.categoryModes = {
      ...post.categoryModes,
      technical_content: 'always_show',
    };
    post.categoryModes = { ...post.categoryModes, sponsored: 'always_show' };
    expect(evaluate(post)).toEqual({
      action: 'show',
      reason: 'protected',
      matchedCategories: ['technical_content', 'sponsored'],
    });
  });

  it('leaves unmatched content and all-neutral defaults visible', () => {
    expect(evaluate(input({ classification: evidence([]) })).reason).toBe(
      'no_matching_rule',
    );
    expect(
      evaluate(input({ categoryModes: createDefaultCategoryModes() })).reason,
    ).toBe('no_matching_rule');
  });

  it('does not infer sponsored from promotion', () => {
    const post = input({ classification: evidence(['promotion']) });
    post.categoryModes = { ...post.categoryModes, sponsored: 'hide' };
    expect(evaluate(post).action).toBe('show');
  });

  it('does not mutate frozen inputs', () => {
    const post = input();
    Object.freeze(post.categoryModes);
    Object.freeze(post.classification?.categories);
    Object.freeze(post.classification);
    const before = JSON.stringify(post);
    evaluate(Object.freeze(post));
    expect(JSON.stringify(post)).toBe(before);
  });
});

describe('insufficient or untrusted remote evidence', () => {
  const badResults: Array<ClassificationResult | null> = [
    null,
    { ...evidence(), sufficiency: 'insufficient', categories: [] },
    ...(
      [
        'insufficient_text',
        'unsupported_language',
        'ambiguous',
        'refused',
      ] as const
    ).map((abstention) => ({ ...evidence(), abstention })),
    {
      ...evidence(),
      categories: [
        { id: 'product_launch', score: NaN, scoreKind: 'typed_membership' },
      ],
    },
    {
      ...evidence(),
      categories: [
        { id: 'product_launch', score: 1, scoreKind: 'self_reported' },
      ],
    },
    {
      ...evidence(),
      categories: [...evidence().categories, ...evidence().categories],
    },
    { ...evidence(), taxonomyVersion: 'unaccepted-taxonomy' },
  ];

  it.each(
    badResults.map((classification, index) => [index, classification] as const),
  )(
    'blocks bad remote evidence %s even with high scores',
    (_index, classification) => {
      expect(evaluate(input({ classification }))).toEqual({
        action: 'show',
        reason: 'insufficient',
        matchedCategories: [],
      });
    },
  );

  it.each(
    badResults.map((classification, index) => [index, classification] as const),
  )(
    'retains local sponsored evidence with bad remote evidence %s',
    (_index, classification) => {
      const post = input({ classification, localSponsored: true });
      post.categoryModes = { ...post.categoryModes, sponsored: 'hide' };
      expect(evaluate(post)).toEqual({
        action: 'collapse',
        reason: 'category_hidden',
        matchedCategories: ['sponsored'],
      });
    },
  );

  it('ignores cached protections and hides on current partial extraction', () => {
    const post = input({ extraction: 'partial', localSponsored: true });
    post.categoryModes = {
      ...post.categoryModes,
      technical_content: 'always_show',
    };
    expect(evaluate(post).action).toBe('show');
    post.categoryModes = { ...post.categoryModes, sponsored: 'hide' };
    expect(evaluate(post)).toEqual({
      action: 'collapse',
      reason: 'category_hidden',
      matchedCategories: ['sponsored'],
    });
  });

  it('local protection overrides a qualified remote hide without a threshold profile', () => {
    const post = input({ thresholds: null, localSponsored: true });
    post.categoryModes = { ...post.categoryModes, sponsored: 'always_show' };
    expect(evaluate(post).reason).toBe('protected');
  });

  it('fails open on invalid preferences', () => {
    const post = input();
    delete (post.categoryModes as Partial<Record<RemoteCategoryId, unknown>>)
      .referral;
    expect(evaluate(post).reason).toBe('insufficient');
  });
});

describe('threshold application', () => {
  it('requires explicit opt-in to experimental remote actions', () => {
    expect(evaluateVisibility(input()).reason).toBe('insufficient');
    expect(evaluate(input()).action).toBe('collapse');
  });

  it('uses evaluated profiles in release policy', () => {
    const post = input();
    post.thresholds = { ...post.thresholds!, validation: 'evaluated' };
    expect(evaluateVisibility(post).action).toBe('collapse');
  });

  it.each([0.899999, 0.9, 0.900001])(
    'applies inclusive hide threshold at %s',
    (score) => {
      const post = input({ classification: evidence(['product_launch']) });
      post.classification!.categories[0]!.score = score;
      expect(evaluate(post).action).toBe(score >= 0.9 ? 'collapse' : 'show');
    },
  );

  it.each([0.699999, 0.7, 0.700001])(
    'applies inclusive protect threshold at %s',
    (score) => {
      const post = input();
      post.classification!.categories[1]!.score = score;
      post.categoryModes = {
        ...post.categoryModes,
        technical_content: 'always_show',
      };
      expect(evaluate(post).action).toBe(score >= 0.7 ? 'show' : 'collapse');
    },
  );

  it('supports per-category overrides and null disables both remote actions', () => {
    const post = input({
      thresholds: createExperimentalThresholdProfile('typesafe', 'test-model', {
        product_launch: { hide: 1, protect: 0.7 },
        technical_content: null,
      }),
    });
    post.categoryModes = {
      ...post.categoryModes,
      technical_content: 'always_show',
    };
    expect(evaluate(post).reason).toBe('no_matching_rule');
  });

  it('does not turn zero score into positive evidence at zero thresholds', () => {
    const post = input({
      classification: evidence(['product_launch']),
      thresholds: createExperimentalThresholdProfile('typesafe', 'test-model', {
        product_launch: { hide: 0, protect: 0 },
      }),
    });
    post.classification!.categories[0]!.score = 0;
    expect(evaluate(post).action).toBe('show');
  });

  it.each(['provider', 'model'] as const)('requires exact %s match', (key) => {
    const post = input();
    post.thresholds = {
      ...post.thresholds!,
      [key]: key === 'provider' ? 'openai' : 'other-model',
    };
    expect(evaluate(post).reason).toBe('insufficient');
  });

  it('ignores malformed remote profiles while retaining local sponsored', () => {
    const post = input({ localSponsored: true });
    post.categoryModes = { ...post.categoryModes, sponsored: 'hide' };
    post.thresholds = {
      ...post.thresholds!,
      categories: {
        ...post.thresholds!.categories,
        product_launch: { hide: NaN, protect: 0.7 },
      },
    };
    expect(evaluate(post).matchedCategories).toEqual(['sponsored']);
  });

  it('exports exactly the stable reason codes', () => {
    expect(VISIBILITY_REASONS).toHaveLength(10);
    expect(new Set(VISIBILITY_REASONS).size).toBe(10);
  });
});
