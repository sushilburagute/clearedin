# Task 11 runtime integration handoff

Status: **partial; release blocked**, 2026-11-16. Baseline has contracts, policy,
storage and provider adapter implementations. The LinkedIn adapter and shared UI
entrypoints remain empty foundation boundaries (tasks 05/06); browser feasibility
and live provider acceptance are pending. This is not an integrated filtering candidate.

## Implemented

- `apps/extension/src/messaging/authorize.ts`: strict contract parsing plus extension
  identity, exact privileged page URL and top-level feed route checks. Popup can pause,
  but cannot access options mutations. Browser metadata is never taken from payloads.
- `apps/extension/src/background/broker.ts`: serialized storage mutations, sanitized
  replies, pause/withdraw/disconnect/reset restoration and status broadcasts. All
  credential entry, resume, provider selection and classification remain unavailable.
- Background entrypoint installs that broker against extension local storage. Only
  `storage` permission is added; no optional provider hosts, network adapters or key
  storage are enabled. Content entrypoint remains inert pending the DOM adapter.
- `Scheduler`: independent injectable single-owner queue, two physical concurrency
  slots, 50 waiting jobs, 100 subscribers per deduplicated job, cancellation and a
  ten-second deadline including queue time. Abort-ignoring dispatch retains its slot
  until settlement, preventing hidden unbounded physical concurrency. Clear invalidates
  late completions. Caller supplies complete cache identity and dispatch function.
- Registry explicitly records all three providers as unavailable. No fallback routing.

## Actual checks

- `pnpm.cmd --filter @clearedin/extension typecheck`: passed.
- `pnpm.cmd exec vitest run tests/integration`: 7 tests passed.
- `pnpm.cmd exec eslint apps/extension/src apps/extension/entrypoints/background.ts tests/integration/runtime.test.ts`: passed.
- Changed TypeScript files formatted with Prettier.

Tests cover sender/frame/route rejection, popup privilege separation, rejection of
credential entry and enabling, reset generation and broadcast, subscriber deduplication,
late-result invalidation, queue capacity and concurrency. These are Node integration
tests; they are **not packaged browser evidence**.

## Remaining integration actions

Task 05 must supply extraction/restoration and task 06 the real control surfaces.
Then connect the injected scheduler to fake classification, current-generation policy
application and complete cache identity computed from actual text (never trust the
content-script digest for cross-tab cache reuse). The injectable dispatch seam now reserves each
attempt durably through the existing usage store before adapter calls and reconciles
usage afterward, checking generation before dispatch and after completion. Its regression verifies stale results are rejected while reservations survive restart. The cache identity helper recomputes SHA-256 from actual text and includes complete configuration and extraction metadata. These helpers are not yet connected to production execution. Retry/circuit, permission and credential enablement, cache wiring,
per-sender message rate limiting and durable runtime race tests are not implemented.
Do not enable dispatch until those controls and feasibility gates are accepted.

Chrome/Firefox packaged tests, restart, multitab accounting, focus, reveal, navigation,
worker suspension and teardown: **not run / pending**. No provider configuration is
validated for production. No remote requests occur through this broker because it
has no outbound execution path. Task 12/13 must retain these as release blockers,
not reinterpret fixture tests as end-to-end acceptance.

