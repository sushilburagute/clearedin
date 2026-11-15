# 04 — Storage, credentials, and durable usage accounting

Status: injected storage implementation complete; see [handoff and validation](../evidence/04-storage-and-credentials.md). Production credential enablement remains gated on task 02's pending browser evidence.

## Dependencies

01 accepted; 02 credential findings accepted before implementing the production key store.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [data-contracts.md](../data-contracts.md), [security-and-privacy.md](../security-and-privacy.md), [provider-integrations.md](../provider-integrations.md).

## Copy-ready assignment

> Implement task 04: Storage, credentials, and durable usage accounting in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/storage/`; its colocated tests and `packages/test-fixtures/src/storage/`.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Implement validated settings, consent records, migrations, reset, and trusted session credential storage behind injected browser APIs.
- Expose sanitized public settings/status separately from privileged credential access.
- Implement durable request reservations and conservative reconciliation, day rollover, serialized writes, and optional known-price estimates.
- Keep unresolved attempts charged against local limits after worker restart.
- Provide generation-aware reset primitives so cleared state cannot be restored by stale callbacks.
- Implement bounded memory cache and diagnostics primitives with documented TTL/retention. The task 11 coordinator owns scheduling and invokes these primitives.

## Acceptance criteria

- Multiple callers cannot exceed the request limit through racing reservations.
- Clock rollback, worker restart, failed responses, unknown usage, and retries preserve conservative accounting.
- Migration tests preserve category intent and fail safely on future schemas.
- Credentials/raw text never enter local settings, exports, browser sync, diagnostic events, or persistent cache.
- Clear-data and disconnect erase all intended records; unsupported session isolation fails closed for credential access.

## Handoff

Document storage API, browser capability requirements, reservation/reconciliation semantics, and reset ordering. Task 11 is the sole runtime writer through this API.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

