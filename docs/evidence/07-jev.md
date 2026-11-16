# Task 07: TypeSafe Jev handoff

Implementation complete; live API and packaged Chrome/Firefox evidence pending.
Baseline: accepted foundation and taxonomy at `14348e8`. Shared branch:
`feat/provider-adapters`. No registry or extension manifest changes.

## Verified contract (2026-11-16)

- [Official System One API](https://docs.typesafe.ai/api/system-one): OpenAPI
  version 0.2.0, POST `https://api.typesafe.ai/v1/systemone`, Bearer authorization.
  Named questions return matching named answers; Noul answers contain `type`
  and `noul`, without separate confidence. Usage reports input/output tokens.
- [Official models](https://docs.typesafe.ai/models): pinned `jev-1.14.0` supports
  Noul. Published billing is USD 0.042 per million input tokens; output is free.
  Questions are not the billing unit. No dynamic alias is accepted.
- [Official JavaScript SDK](https://docs.typesafe.ai/sdk/javascript): Node.js 22+
  is documented. This is not proof of direct extension support; packaged browser
  access and provider-supported client credential custody remain untested.

## Interfaces and safety

`@clearedin/providers/typesafe` exports `createTypeSafeAdapter(NetworkClient)`,
`TYPESAFE_MODEL`, `typesafeCapabilities`, and `TypeSafeProviderError`. Errors
contain a frozen-contract code and retryability, never provider text or keys.
The capability metadata declares `https://api.typesafe.ai/*` as the required
optional host permission; task 11 owns registration and permissions.

Uses frozen taxonomy questions, eleven independent category Nouls and one
sufficiency Noul. Membership is not separate confidence. Sufficiency below 0.90
clears every judgment; this threshold is experimental pending evaluation.
Partial/empty input stays local. Unsupported versions/models, missing answers,
wrong primitives, unexpected answer keys, invalid values, refusal-shaped bodies,
malformed JSON and responses above 32 KiB cannot produce usable classification.
Request size is capped at 64 KiB, with no images, tools, retries, or gateway.
Redirects are rejected; cancellation propagates through fetch and body reading.
Metadata comes from local configuration and the result is validated again.

## Validation and handoff

Changed paths: `packages/providers/src/typesafe/`,
`packages/test-fixtures/src/providers/typesafe/`, and this evidence file.
Coordinator adds taxonomy dependency and the public package subpath export.

- `pnpm exec vitest run packages/providers/src/typesafe/tests`: 17 passed;
  one opt-in live test skipped.
- `pnpm exec eslint packages/providers/src/typesafe packages/test-fixtures/src/providers/typesafe`:
  passed.
- `pnpm boundaries:check`: no TypeSafe violations after making unit-test fixtures
  local; other concurrent changes still had LinkedIn/Anthropic fixture-boundary
  violations at handoff. The separate exported synthetic fixture is retained for
  evaluation consumers.
- Package TypeScript check initially exposed an unrelated missing UI `./demo`
  file; coordinator runs final workspace checks after parallel work settles.

Live smoke runner: explicitly set `CLEAREDIN_LIVE_TYPESAFE=1` and securely supply
`TYPESAFE_API_KEY`, then run the scoped Vitest command above. It makes one synthetic
request, no retries, with a ten-second abort deadline; it prints no credentials
or provider response. This Node check does not prove packaged browser access.
No live request was made because credentials and explicit live testing were not
provided. Before release, task 11 must resolve browser access/custody and task 12
must evaluate calibration and semantic accuracy. Do not enable production hiding
on unit-test success alone.

## Isolated integration validation

Validated on branch `feat/provider-integrations` in a separate worktree against baseline `14348e8`. `pnpm test`: 214 tests passed, one opt-in live test skipped, plus 12 boundary-script tests passed. `pnpm lint`, `pnpm typecheck`, `pnpm docs:check`, and `pnpm format:check` passed. Earlier shared-workspace UI errors are absent from this isolated provider change. Live API and packaged-browser evidence remain pending.
