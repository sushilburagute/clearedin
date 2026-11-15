# Task 03 taxonomy and policy handoff

Status: **implementation complete**. Provider quality evaluation and release calibration remain pending. Date: 2026-11-16. Prerequisite: accepted task 01 handoff, merged in `e475aeb`; implementation baseline also includes task 02 merge `21775cd`. Work is on the coordinator's shared `feat/03-04-policy-and-storage` branch; no separate child commit or checkout.

## Files and public interfaces

- `packages/taxonomy/src/definitions.ts` preserves the foundation's twelve definitions, boundaries, synthetic positive/negative examples, stable ordering, and `TAXONOMY_VERSION = '1.0.0'`. `src/index.ts` remains the public entrypoint.
- `packages/taxonomy/src/prompts.ts` adds `PROMPT_VERSION = '1.0.0'`, `QUESTION_VERSION = '1.0.0'`, eleven immutable `CATEGORY_QUESTIONS`, `SUFFICIENCY_QUESTION`, `CLASSIFICATION_INSTRUCTIONS`, and `buildClassificationPrompt`. The builder validates input and versions and returns instructions separately from JSON-serialized untrusted post data. Task 07 owns the Jev wire format; tasks 08/09 own provider-specific structured-output schemas and score semantics. No tools or provider execution are included.
- `packages/decision-engine/src/index.ts` exports `evaluateVisibility`, `createVisibilityEvaluator`, `VISIBILITY_REASONS`, and the frozen shared policy types. `src/thresholds.ts` exports `defineThresholdProfile`, `createExperimentalThresholdProfile`, `selectThresholdProfile`, experimental version/default constants, and `EVALUATED_THRESHOLD_PROFILES`.
- `packages/test-fixtures/src/policy/index.ts`, exported as `@clearedin/test-fixtures/policy`, provides fourteen immutable `POLICY_FIXTURES`, `createPolicyInput`, `createPolicyClassification`, and synthetic model/version markers. Fixtures include overlap, neutral rules, deterministic multiple reasons, injection text, contradictory abstention, cached high scores with partial extraction, reveal, consent, and both directions of local/remote sponsored precedence. Deliberately contradictory evidence is marked by the fixture documentation and is rejected by policy.
- Colocated tests: `packages/decision-engine/tests/{policy,thresholds}.test.ts`, `packages/taxonomy/tests/prompts.test.ts`, and `packages/test-fixtures/tests/policy.test.ts`; existing taxonomy tests remain intact.

Coordinated manifest changes add the decision engine's existing taxonomy workspace dependency and the policy fixture export. No shared contract or schema changes, category renames, dependencies from outside the workspace, or migrations are required.

## Policy semantics

The evaluator is synchronous and pure. Disabled, consent, route, identity, and extractor guards precede reveal, then remote evidence validation, protection, hiding, and neutral display. It never reads post text, browser state, storage, network, credentials, or time. UI reasons are fixed contract codes and matched category IDs in taxonomy order. Re-evaluating a retained classification with new preferences needs no provider call.

Remote evidence must satisfy the strict classification schema, current complete extraction, sufficient/non-abstaining output, current taxonomy version, and an exact provider/model threshold profile. Invalid results, any abstention, malformed scores or semantics, duplicate categories, missing profiles, and partial extraction cannot supply remote hiding **or protection**. A zero score is not positive evidence, even with a zero threshold. Null threshold entries disable remote actions for that category. Threshold comparisons are inclusive.

The trusted `localSponsored` input represents a tested visible DOM disclosure. It independently qualifies its sponsored rule, including with null/invalid remote evidence or partial extraction. It still requires global guards and consent, honors reveal, participates in protection precedence, and never comes from model tone. Local disclosure does not require remote calibration or a selected model.

`evaluateVisibility` accepts only profiles labeled `evaluated` for remote actions. **No evaluated provider/model profiles ship:** the exported release list is empty. Synthetic demonstrations and evaluation harnesses explicitly opt into `createVisibilityEvaluator({ allowExperimental: true })`; experimental defaults are hide `0.90` and protect `0.70`. These values are experimental starting points, not calibrated probabilities. Profile definition validates and deeply freezes a copy. Selection requires an exact provider/model match and rejects ambiguous configurations. Evaluated labels are trusted packaged configuration, not a substitute for actual held-out evidence.

## Validation evidence

Run on Windows with the repository's existing pinned toolchain:

| Command | Actual result |
| --- | --- |
| `pnpm exec vitest run packages/decision-engine/tests packages/taxonomy/tests packages/test-fixtures/tests/policy.test.ts` | Pass: 67 tests in 5 files, including existing taxonomy tests |
| `pnpm exec tsc --noEmit -p tsconfig.packages.json` | Pass: zero diagnostics |
| `pnpm exec eslint packages/taxonomy packages/decision-engine packages/test-fixtures/src/policy packages/test-fixtures/tests/policy.test.ts` | Pass |
| `pnpm exec prettier --write packages/taxonomy packages/decision-engine packages/test-fixtures/src/policy packages/test-fixtures/tests/policy.test.ts` | Completed |

No live browser/provider checks were run for this pure component; no provider credentials or network access are needed. Fixture tests are policy mechanics and asset checks, not classifier accuracy or release evaluation. The coordinator records broader repository checks in the combined PR.

## Next integration actions and limits

Task 11 validates provider/model/adapter/prompt configuration and request correlation before passing results into policy; the frozen policy input carries no expected adapter/prompt tuple. Reject stale callbacks using runtime generations. Use the current extraction completeness even when reusing a cache entry. The boolean sponsored signal must come only from the tested DOM adapter.

Tasks 07–09 consume the frozen taxonomy/prompt/question assets before provider evaluation. Task 12 must produce held-out evaluation evidence before a release profile is added. Changes to assets, thresholds, adapters, or models require relevant re-evaluation and cache namespace changes. Prompt separation reduces instruction confusion but does not establish model resistance to injection; adversarial accuracy remains an evaluation responsibility. Task 06/10 can consume definitions and the synthetic policy fixture subpath for UI/demo behavior while clearly retaining synthetic markers.
