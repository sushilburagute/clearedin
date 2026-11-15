# 01 — Foundation and shared contracts

Status: **complete**, 2026-11-16, on `feat/01-foundation-and-contracts`. See the [implementation handoff and validation evidence](../evidence/01-foundation.md).

## Completion record

- [x] Pinned workspace, app shells, and all required root commands.
- [x] Runtime schemas, shared interfaces, taxonomy, and explicit synthetic fixtures.
- [x] Dependency-direction guard and minimal CI without publishing.
- [x] Fresh frozen-lockfile install in a clean staged copy, lint, formatting, strict typechecks, 46 tests, and local documentation checks.
- [x] Static website build, Chrome/Firefox MV3 packaging, manifest checks, and ZIP/build byte parity.
- [x] Public interface map and downstream ownership handoff documented.

Packaged-browser execution, live-provider feasibility, filtering behavior, and production release gates belong to later tasks. `pnpm test:integration` reports NOT IMPLEMENTED with exit code 2; it is not counted as a passing test suite.

## Dependencies

None. Run this first.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [software-architecture.md](../software-architecture.md), [data-contracts.md](../data-contracts.md), [classification-and-rules.md](../classification-and-rules.md), [testing-and-evaluation.md](../testing-and-evaluation.md).

## Copy-ready assignment

> Implement task 01: Foundation and shared contracts in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

Root workspace/build/test configuration and lockfile; `.github/workflows/`; initial app/package manifests and empty entrypoints; `packages/contracts/`; initial `packages/taxonomy/`; `packages/providers/src/types.ts`; `packages/test-fixtures/src/fake-classifier/`.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Scaffold the proposed pnpm/TypeScript workspace, WXT/React extension, and Astro website with pinned compatible versions.
- Establish the root scripts listed in testing-and-evaluation.md. Empty integration suites must report not implemented, not falsely claim end-to-end coverage.
- Implement runtime schemas and exported types for categories, settings, consent, provider input/result, error codes, messages, and public status.
- Freeze public interfaces for storage, extraction, policy evaluation, provider adapters, and the UI message client in packages/contracts. Include cancellation, enablement generation, content identity, extraction completeness, and injected clock/network/browser dependencies.
- Define the shared adapter type in providers/src/types.ts and reserve providers/src/registry.ts for task 11. Create provider subdirectory boundaries for tasks 07–09.
- Seed stable taxonomy IDs/definitions and a deterministic synthetic fake classifier. Freeze these exports before downstream work starts.
- Add dependency-direction checks so website/UI cannot import credential or provider execution code. Initialize a minimal CI build without publishing.

## Acceptance criteria

- Fresh install, lint, typecheck, unit tests, website build, and both extension packages work.
- Contract tests reject unknown categories, duplicate scores, invalid ranges, oversized payloads, and contradictory abstention results.
- Public API signatures, root scripts, folder layout, and fixture imports are documented in the handoff.
- No provider keys, placeholder production assertions, or remote executable code enter artifacts.

## Handoff

Publish the foundation commit and interface map. Once accepted, ownership of feature directories transfers to the named tasks. Root configuration, shared contract changes, and lockfile edits remain coordinated by the integration owner.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

