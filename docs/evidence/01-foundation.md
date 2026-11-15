# Task 01 foundation handoff

Status: **complete**. Implementation date: 2026-11-16. Branch: `feat/01-foundation-and-contracts`; baseline: `5472201`. The task-completion commit contains this evidence and the implementation together.

## Scope delivered

The repository now has a pinned pnpm workspace, a static Astro preview, and inert WXT/React extension shells for Chrome and Firefox MV3. Contracts, taxonomy, synthetic fixtures, dependency checks, and CI are implemented. Decision-engine, storage, DOM adapter, and UI packages are reserved shells; no feed filtering or provider execution is implemented.

Node is pinned to 24.22.3 and pnpm to 12.4.1. Core pins are TypeScript 5.9.3, WXT 0.21.5, React 19.3.1, Astro 7.4.12, Zod 4.6.7, and Vitest 5.1.0. Exact direct versions and transitive resolutions are committed. The selected TypeScript version satisfies the lint tooling's peer range. Setup and commands are in the [root README](../../README.md).

## Public interface map

All contracts are imported from `@clearedin/contracts`; static types are inferred from runtime schemas where applicable. Protocol/schema version is 1; taxonomy version is 1.0.0. No published npm API is implied.

| Boundary | Exports | Next consumer/owner |
| --- | --- | --- |
| Identity and enums | `CATEGORY_IDS`, `REMOTE_CATEGORY_IDS`, `PROVIDER_IDS`, their schemas/types, `CONTRACT_VERSION` | All tasks; shared changes coordinated |
| Provider classification | `ClassificationInputSchema`, `ClassificationResultSchema`, `CategoryJudgmentSchema`, `UsageSchema`, `PublicErrorSchema`, inferred types | 07–09, 11 |
| Configuration | `SettingsSchema`, `PreferencesSchema`, `ConsentRecordSchema`, `MoneyAmountSchema`, `EstimatedCostCapSchema`, `createDefaultSettings`, `createDefaultCategoryModes` | 04, 06, 11 |
| Local post identity | `PostIdentitySchema`, `ExtractedPostSchema`, `PostIdentity`, `ExtractedPost` | 05, 11 |
| IPC requests/replies | `ContentRequestSchema`, `PopupRequestSchema`, `OptionsRequestSchema`, `RequestMessageSchema`, `ReplyMessageSchema`, `BroadcastMessageSchema`, `ReplyFor` | 06, 11 |
| UI transport | `ContentClient`, `PopupClient`, `OptionsClient`, `MessageClient` | 06, 11 |
| Status/diagnostics | `PublicStatusSchema`, `DiagnosticEventSchema`, `DiagnosticExportSchema` and inferred types | 04, 06, 11 |
| Provider adapter | `ClassifierAdapter`, `ProviderContext`, `ProviderDependencies`, `ProviderConfiguration` | 07–09 |
| Policy | `PolicyInput`, `VisibilityDecision`, `VisibilityReason`, `EvaluateVisibility`, `ThresholdProfile` | 03, 05, 10, 11 |
| DOM integration | `ExtractionAdapter`, `ExtractionCallbacks` | 05, 11 |
| Persistence | `SettingsStore`, `CredentialStore`, `UsageStore`, `ClassificationCache`, `ClassificationCacheKey`, `DiagnosticsBuffer` and snapshot/reservation types | 04, 11 |
| Injected dependencies | `Clock`, `NetworkClient`, `BrowserCapabilities`, `BrowserPorts`, `KeyValueStore`, `MessageSender`, `AuthorizedRequest` | 02, 04, 07–09, 11 |

Exact signatures: [interfaces.ts](../../packages/contracts/src/interfaces.ts). Wire details and typed reply mapping: [messaging.ts](../../packages/contracts/src/messaging.ts). The provider package exposes only `@clearedin/providers/types`, which re-exports the canonical adapter/context types; website/UI must import safe types from contracts instead. Registry and provider directories are reserved for tasks 07–09/11.

## Invariants for downstream agents

- Input carries bounded text and schema/prompt versions; local post identity, credentials, destinations, and arbitrary prompts are rejected from provider input.
- Remote results cannot contain `sponsored`; that signal belongs to the DOM adapter. Unknown categories/fields, duplicate category scores, nonfinite/out-of-range scores, and mismatched score semantics fail validation.
- Abstentions require insufficient results with no remote category judgments. Current extraction completeness is separately retained in policy and cache interfaces.
- All settings begin disabled with neutral categories. Granted consent must match the selected provider. Enabling requires selected provider/model and consent; credential availability and actual sender authorization remain runtime responsibilities.
- Content/popup cannot request full settings, set credentials, or invoke options-only commands. Popup may pause/resume. Options can reload non-secret settings and request a fixed synthetic connection test. Compile-time restrictions complement runtime schemas; neither replaces task 11's sender checks.
- `PublicError` has local reason codes, never raw upstream error messages. Status and diagnostics have no raw text, hashes, URLs, headers, or credential fields.
- Monetary amounts allow zero; budget caps must be positive. Storage writes/reservations carry expected enablement generation. These are ports, not implemented transactional storage or spend guarantees.

## Taxonomy and fixtures

`@clearedin/taxonomy` exports `TAXONOMY_VERSION`, `CATEGORY_DEFINITIONS`, `CATEGORY_DEFINITION_BY_ID`, and `CategoryDefinition`. Definitions include positive/negative examples for all twelve categories.

`@clearedin/test-fixtures/fake-classifier` exports `createSyntheticClassifier`, `createSyntheticInput`, `SYNTHETIC_FIXTURES`, synthetic version/model constants, and fixture/classifier types:

```ts
import {
  createSyntheticClassifier,
  createSyntheticInput,
} from '@clearedin/test-fixtures/fake-classifier';

const result = await createSyntheticClassifier().classify(
  createSyntheticInput('job-referral'),
  { signal: new AbortController().signal },
);
```

The fake accepts only exact registered synthetic input, preserves request correlation, rejects credential-bearing context, and honors cancellation. It is deliberately not a production `ClassifierAdapter`. Its normalized `provider: 'typesafe'` is a fixture shape only; the synthetic model/adapter markers must stay visible. Its scores are predetermined examples, not model evaluation evidence.

## Workspace conventions and ownership handoff

The task paths match the assignment guide. WXT entrypoints are `apps/extension/entrypoints/background.ts`, `content.ts`, `popup/`, and `options/`. App manifests/configs and root tooling are coordinated files. Task 06 owns popup/options after handoff; task 11 owns content/background and provider registration. Package public entrypoints are `src/index.ts`, except providers' type subpath and the explicit fixture subpath.

Workspace packages expose source TypeScript for bundling and tests; feature agents do not need to create a second build system. Shared-package strict typechecking uses `tsconfig.packages.json`. App checks use their framework configurations. Tests belong in `packages/<name>/tests/*.test.ts`; script guard tests use Node's test runner under `scripts/tests/`.

The architectural guard checks package manifests, source imports/re-exports, relative escapes, inherited TypeScript aliases, workspace exports, dynamic imports/require, and Astro scripts/frontmatter. Computed specifiers are rejected. UI/website cannot reach provider or storage execution packages, even through allowed intermediary packages. It is a source guard, not a sandbox or dependency security audit; represent custom bundler aliases in TypeScript config as well.

## Validation evidence

Validated on Windows with Node 24.22.3 and pnpm 12.4.1, including a clean staged copy outside the working tree with no preexisting node_modules or generated app outputs. Installation used the frozen lockfile and the local package cache. A compile-test comment placement issue exposed after formatting was fixed in both source and validation copy before the final successful run.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` in clean copy | Pass; all 11 workspace projects installed, WXT types generated |
| `pnpm lint` | Pass; ESLint and architectural-boundary CLI |
| `pnpm format:check` | Pass |
| `pnpm typecheck` | Pass; shared packages, compile-only privilege assertions, extension, and Astro (zero diagnostics) |
| `pnpm test` | Pass; 34 Vitest cases (25 contracts, 9 taxonomy/fixtures) and 12 Node boundary-guard cases; **46 total** |
| `pnpm docs:check` | Pass; local links and code fences in 30 root/docs Markdown files |
| `pnpm build` | Pass; static site and both MV3 browser outputs |
| `pnpm package:chrome` / `pnpm package:firefox` | Pass; development ZIPs generated |
| `pnpm artifacts:check` | Pass; manifest/source checks and ZIP/build byte parity |
| `pnpm test:integration` | Expected NOT IMPLEMENTED, exit 2; not a passing integration suite |
| Hosted CI / other operating systems | Not run here; workflow is committed for later execution |

Generated outputs are ignored by Git and reproducible with the commands above. The final documentation status updates were checked again before committing.

The artifact audit inspects manifests, feed-only content matches, empty runtime/provider permissions, CSP, local code references, basic credential patterns, and byte parity between browser ZIPs and build directories. It does not establish live browser behavior or comprehensive secret/security coverage.

`pnpm test:integration` intentionally reports NOT IMPLEMENTED and exits 2. No API credentials were supplied, provider requests made, or live LinkedIn/browser extension behavior tested. Task 02 is responsible for browser feasibility; tasks 07–09/11 for provider access and runtime wiring.

Firefox is packaged with a development-only ID, minimum version 140, and a no-data declaration because the current shell transmits nothing. These must be reviewed before adding real functionality. The extension-local source ZIP is not yet a complete monorepo reviewer bundle. See [WXT browser targets](https://wxt.dev/guide/essentials/target-different-browsers.html), [Mozilla consent guidance](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/), and [Mozilla manifest settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings).

## Next actions

Start dependent work from the foundation commit. Tasks 02, 03, 06, and provider adapter scaffolding can use these contracts. Task 04 waits for the credential-feasibility result from 02; task 05 also consumes its browser findings. No downstream task is marked complete by this handoff. All public release decisions and production quality gates remain open.
