import {
  CATEGORY_IDS,
  CategoryModesSchema,
  ClassificationResultSchema,
  type CategoryId,
  type EvaluateVisibility,
  type PolicyInput,
  type ThresholdProfile,
  type VisibilityDecision,
  type VisibilityReason,
} from '@clearedin/contracts';
import { TAXONOMY_VERSION } from '@clearedin/taxonomy';
import { defineThresholdProfile } from './thresholds';

export * from './thresholds';
export type {
  EvaluateVisibility,
  PolicyInput,
  ThresholdProfile,
  VisibilityDecision,
  VisibilityReason,
} from '@clearedin/contracts';

/** Stable contract reason codes; UI copy is local and never model-authored. */
export const VISIBILITY_REASONS = Object.freeze([
  'disabled',
  'consent_required',
  'unsupported_route',
  'stale_identity',
  'extractor_unhealthy',
  'revealed',
  'insufficient',
  'protected',
  'category_hidden',
  'no_matching_rule',
] as const satisfies readonly VisibilityReason[]);

function show(
  reason: VisibilityReason,
  matchedCategories: readonly CategoryId[] = [],
): VisibilityDecision {
  return { action: 'show', reason, matchedCategories };
}

/** Pure, deterministic policy. Experimental remote actions require explicit opt-in. */
export function createVisibilityEvaluator(
  options: { allowExperimental?: boolean } = {},
): EvaluateVisibility {
  const allowExperimental = options.allowExperimental === true;
  return (input: PolicyInput): VisibilityDecision => {
    if (input.enabled !== true) return show('disabled');
    if (input.consentGranted !== true) return show('consent_required');
    if (input.supportedRoute !== true) return show('unsupported_route');
    if (input.validIdentity !== true) return show('stale_identity');
    if (input.extractorHealthy !== true) return show('extractor_unhealthy');
    if (input.revealed === true) return show('revealed');

    const modes = CategoryModesSchema.safeParse(input.categoryModes);
    if (!modes.success) return show('insufficient');
    const parsed = ClassificationResultSchema.safeParse(input.classification);
    let profile: ThresholdProfile | null = null;
    try {
      if (input.thresholds !== null)
        profile = defineThresholdProfile(input.thresholds);
    } catch {
      // Bad remote calibration cannot suppress an independent local disclosure.
    }
    const remoteUsable =
      parsed.success &&
      input.extraction === 'complete' &&
      parsed.data.sufficiency === 'sufficient' &&
      parsed.data.abstention === null &&
      parsed.data.taxonomyVersion === TAXONOMY_VERSION &&
      profile !== null &&
      profile.provider === parsed.data.provider &&
      profile.model === parsed.data.model &&
      (profile.validation === 'evaluated' || allowExperimental);
    const scores = new Map<CategoryId, number>();
    if (remoteUsable && parsed.success) {
      for (const judgment of parsed.data.categories)
        scores.set(judgment.id, judgment.score);
    }
    const protectedCategories: CategoryId[] = [];
    const hiddenCategories: CategoryId[] = [];
    for (const id of CATEGORY_IDS) {
      // Reliable visible disclosure is a binary local fact, independent of models.
      const local = id === 'sponsored' && input.localSponsored === true;
      const score = scores.get(id);
      const pair = profile?.categories[id];
      if (
        modes.data[id] === 'always_show' &&
        (local ||
          (score !== undefined &&
            score > 0 &&
            pair != null &&
            score >= pair.protect))
      ) {
        protectedCategories.push(id);
      }
      if (
        modes.data[id] === 'hide' &&
        (local ||
          (score !== undefined &&
            score > 0 &&
            pair != null &&
            score >= pair.hide))
      ) {
        hiddenCategories.push(id);
      }
    }
    if (protectedCategories.length > 0)
      return show('protected', protectedCategories);
    if (hiddenCategories.length > 0)
      return {
        action: 'collapse',
        reason: 'category_hidden',
        matchedCategories: hiddenCategories,
      };
    return show(remoteUsable ? 'no_matching_rule' : 'insufficient');
  };
}

/** Release policy: no experimental remote thresholds are applied by default. */
export const evaluateVisibility: EvaluateVisibility =
  createVisibilityEvaluator();
