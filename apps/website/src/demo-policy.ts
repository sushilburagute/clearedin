import {
  CategoryModeSchema,
  createDefaultCategoryModes,
  type CategoryId,
  type ClassificationResult,
  type PolicyInput,
  type VisibilityDecision,
} from '@clearedin/contracts';
import {
  createExperimentalThresholdProfile,
  createVisibilityEvaluator,
} from '@clearedin/decision-engine';
import { CATEGORY_DEFINITION_BY_ID } from '@clearedin/taxonomy';
import {
  createSyntheticClassifier,
  createSyntheticInput,
  SYNTHETIC_FIXTURES,
  SYNTHETIC_MODEL,
  type SyntheticFixtureId,
} from '@clearedin/test-fixtures/fake-classifier';

const abstentionText = {
  ambiguous: 'The example is ambiguous.',
  insufficient_text: 'There is too little text to classify.',
  unsupported_language: 'The language is outside the demo’s coverage.',
  refused: 'The example represents a provider refusal.',
};

function describeDecision(decision: VisibilityDecision, input: PolicyInput) {
  const labels = decision.matchedCategories
    .map((id) => CATEGORY_DEFINITION_BY_ID[id].label)
    .join(', ');
  switch (decision.reason) {
    case 'category_hidden':
      return `Hidden · ${labels}`;
    case 'protected':
      return `Always show · ${labels}`;
    case 'revealed':
      return 'Revealed for this page session';
    case 'disabled':
      return 'Visible while the demo is paused';
    default:
      if (input.localSponsored)
        return 'Visible · Sponsored posts are shown normally.';
      if (input.classification?.abstention)
        return `Visible · ${abstentionText[input.classification.abstention]}`;
      return 'Visible · No hidden category matched.';
  }
}

const evaluate = createVisibilityEvaluator({ allowExperimental: true });
const thresholds = createExperimentalThresholdProfile(
  'typesafe',
  SYNTHETIC_MODEL,
);

interface DemoOutcome {
  hidden: boolean;
  message: string;
}

export interface DemoPolicy {
  categories: CategoryId[];
  outcomes: Record<string, DemoOutcome>;
  paused: DemoOutcome;
  revealed: DemoOutcome;
}

function outcome(input: PolicyInput): DemoOutcome {
  const decision = evaluate(input);
  return {
    hidden: decision.action === 'collapse',
    message: describeDecision(decision, input),
  };
}

// Only categories present in a fixed sample can change its decision. Evaluate
// their combinations at build time so the client needs no classifier or schemas.
function policyFor(
  classification: ClassificationResult | null,
  extraction: PolicyInput['extraction'],
  localSponsored = false,
): DemoPolicy {
  const categories: CategoryId[] =
    classification?.categories.map(({ id }) => id) ?? [];
  if (localSponsored) categories.push('sponsored');
  const base: PolicyInput = {
    enabled: true,
    consentGranted: true,
    supportedRoute: true,
    validIdentity: true,
    extractorHealthy: true,
    revealed: false,
    extraction,
    localSponsored,
    classification,
    categoryModes: createDefaultCategoryModes(),
    thresholds,
  };
  let combinations = [base.categoryModes];
  for (const category of categories) {
    combinations = combinations.flatMap((modes) =>
      CategoryModeSchema.options.map((mode) => ({
        ...modes,
        [category]: mode,
      })),
    );
  }
  const outcomes = Object.fromEntries(
    combinations.map((categoryModes) => [
      categories.map((id) => categoryModes[id]).join('/'),
      outcome({ ...base, categoryModes }),
    ]),
  );
  return {
    categories,
    outcomes,
    paused: outcome({ ...base, enabled: false }),
    revealed: outcome({ ...base, revealed: true }),
  };
}

export async function buildDemoPolicies() {
  const classifier = createSyntheticClassifier();
  const { signal } = new AbortController();
  const policies = new Map(
    await Promise.all(
      SYNTHETIC_FIXTURES.map(async (fixture) => {
        const classification = await classifier.classify(
          createSyntheticInput(fixture.id as SyntheticFixtureId),
          { signal },
        );
        return [
          fixture.id,
          policyFor(classification, fixture.extraction),
        ] as const;
      }),
    ),
  );
  policies.set('sponsored', policyFor(null, 'complete', true));
  return policies;
}
