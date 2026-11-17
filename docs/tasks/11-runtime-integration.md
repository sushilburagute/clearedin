# 11 — Extension coordinator and end-to-end integration

Status: partial. Local settings broker, validated UI transport, injected coordinator/scheduler/content lifecycle, and offline integration tests exist. Production inference and packaged-browser acceptance remain pending. See the [handoff](../evidence/11-runtime.md).

## Dependencies

01–09 accepted for full integration. A fake-classifier milestone can begin once 02–06 are accepted while 07–09 finish.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [software-architecture.md](../software-architecture.md), [data-contracts.md](../data-contracts.md), [provider-integrations.md](../provider-integrations.md), [security-and-privacy.md](../security-and-privacy.md), [testing-and-evaluation.md](../testing-and-evaluation.md).

## Copy-ready assignment

> Implement task 11: Extension coordinator and end-to-end integration in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`apps/extension/entrypoints/background.ts`; `apps/extension/entrypoints/content.ts`; `apps/extension/src/background/`; `apps/extension/src/content/`; `apps/extension/src/messaging/`; extension configuration/manifests; `packages/providers/src/registry.ts`; `tests/integration/`. Own shared wiring only; component internals remain with their original owner until explicit handoff.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Wire DOM adapter, storage, policy, UI messages, and fake classifier first. Demonstrate complete offline control before remote inference.
- Implement broker sender/type/route validation, trusted credential routing, optional permissions, status broadcasts, and options/popup privilege separation.
- Implement one global scheduler with queue/concurrency caps, subscriber dedup, complete cache identity, cancellation, deadlines, retry/circuit rules, and durable reservations.
- Wire provider registry and enable only feasible configurations; never silently route to another provider.
- Apply current consent/settings/identity/generation to every result. Restore on pause, withdrawal, reset, route exit, errors, and recycled nodes.
- Add packaged browser tests for restart, multi-tab accounting, stale callbacks, forbidden message paths, focus, and teardown.
- Merge proposed root/dependency changes in a controlled sequence; run broad checks after integration.

## Acceptance criteria

- Synthetic feed passes the core product stories in both packaged browsers.
- No remote traffic occurs before consent or after withdrawal; privileged calls from content scripts are rejected.
- Pause and clear-data invalidate late callbacks and restore content.
- Cache completeness, per-post reveal, worker suspension, request-limit races, and retry billing have regressions.
- Unverified provider/browser combinations remain visibly unavailable; live evidence is tracked separately.

## Handoff

Deliver the integrated candidate, exact commands/artifacts, browser support matrix, unresolved gaps, and tested provider configurations to task 12. Root integration changes remain single-writer.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

