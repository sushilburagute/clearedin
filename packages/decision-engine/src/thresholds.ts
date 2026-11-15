import {
  CATEGORY_IDS,
  ModelIdSchema,
  ProviderIdSchema,
  VersionSchema,
  type CategoryId,
  type ProviderId,
  type ThresholdPair,
  type ThresholdProfile,
} from '@clearedin/contracts';

/** Starting points for experiments, never calibrated release defaults. */
export const EXPERIMENTAL_THRESHOLD_VERSION = 'experimental-1.0.0';
export const EXPERIMENTAL_THRESHOLDS: Readonly<ThresholdPair> = Object.freeze({
  hide: 0.9,
  protect: 0.7,
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate and copy configuration so later caller mutation cannot change policy. */
export function defineThresholdProfile(
  value: ThresholdProfile,
): ThresholdProfile {
  if (
    !record(value) ||
    Object.keys(value).sort().join(',') !==
      'categories,model,provider,validation,version' ||
    !ProviderIdSchema.safeParse(value.provider).success ||
    !ModelIdSchema.safeParse(value.model).success ||
    !VersionSchema.safeParse(value.version).success ||
    !['experimental', 'evaluated'].includes(value.validation) ||
    !record(value.categories) ||
    Object.keys(value.categories).sort().join(',') !==
      [...CATEGORY_IDS].sort().join(',')
  ) {
    throw new Error('Invalid threshold profile.');
  }
  const categories = {} as Record<CategoryId, Readonly<ThresholdPair> | null>;
  for (const id of CATEGORY_IDS) {
    const pair = value.categories[id];
    if (pair === null) {
      categories[id] = null;
      continue;
    }
    if (
      !record(pair) ||
      Object.keys(pair).sort().join(',') !== 'hide,protect' ||
      ![pair.hide, pair.protect].every(
        (score) =>
          typeof score === 'number' &&
          Number.isFinite(score) &&
          score >= 0 &&
          score <= 1,
      )
    ) {
      throw new Error('Invalid category threshold.');
    }
    categories[id] = Object.freeze({ hide: pair.hide, protect: pair.protect });
  }
  return Object.freeze({ ...value, categories: Object.freeze(categories) });
}

export function createExperimentalThresholdProfile(
  provider: ProviderId,
  model: string,
  overrides: Partial<Record<CategoryId, ThresholdPair | null>> = {},
): ThresholdProfile {
  if (
    Object.keys(overrides).some(
      (id) => !CATEGORY_IDS.includes(id as CategoryId),
    )
  ) {
    throw new Error('Unknown threshold category.');
  }
  return defineThresholdProfile({
    provider,
    model,
    version: EXPERIMENTAL_THRESHOLD_VERSION,
    validation: 'experimental',
    categories: Object.fromEntries(
      CATEGORY_IDS.map((id) => [
        id,
        Object.hasOwn(overrides, id) ? overrides[id] : EXPERIMENTAL_THRESHOLDS,
      ]),
    ) as Record<CategoryId, ThresholdPair | null>,
  });
}

/** No provider/model has held-out evaluation evidence in this implementation. */
export const EVALUATED_THRESHOLD_PROFILES: readonly ThresholdProfile[] =
  Object.freeze([]);

/** Exact match only: never borrow calibration from another provider or model. */
export function selectThresholdProfile(
  profiles: readonly ThresholdProfile[],
  provider: ProviderId,
  model: string,
  options: { allowExperimental?: boolean } = {},
): ThresholdProfile | null {
  const matches = profiles
    .map(defineThresholdProfile)
    .filter(
      (profile) =>
        profile.provider === provider &&
        profile.model === model &&
        (profile.validation === 'evaluated' ||
          options.allowExperimental === true),
    );
  if (matches.length > 1) throw new Error('Ambiguous threshold configuration.');
  return matches[0] ?? null;
}
