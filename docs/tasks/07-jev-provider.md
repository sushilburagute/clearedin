# 07 — TypeSafe Jev adapter

Status: unassigned; no implementation started by this brief.

## Dependencies

01 accepted; use taxonomy from 03 for final semantic tests. Packaged live proof follows 02/11 as applicable.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [provider-integrations.md](../provider-integrations.md), [classification-and-rules.md](../classification-and-rules.md), [data-contracts.md](../data-contracts.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 07: TypeSafe Jev adapter in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/providers/src/typesafe/`; `packages/test-fixtures/src/providers/typesafe/`; `docs/evidence/07-jev.md`.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Verify the current official TypeSafe API contract, endpoint, auth, model identifier, browser-client support, and billing units; record sources/date.
- Implement independent typed category questions plus sufficiency. Preserve multi-label results and distinguish Noul membership from a separate confidence value.
- Normalize into the frozen result schema, including trusted metadata, abstention, usage, and error classes.
- Use injected fetch/abort signal; enforce payload/response bounds and destination restrictions. Retry, budgets, and provider switching belong to task 11.
- Add synthetic contract fixtures and a bounded, opt-in live smoke runner. Register no secret or credential in source.
- Export adapter metadata and required host permissions for the integration owner.

## Acceptance criteria

- Typed judgments are not implemented as assumed chat-generated JSON.
- Refusal/insufficiency/invalid values cannot cause hiding.
- Cancellation and malformed/oversized/error responses are handled.
- Live browser access is reported proven, failed, or untested separately from unit-test success. Missing credentials leave live checks pending.

## Handoff

Export the adapter and capability manifest; record model/API versions, score semantics, pricing verification, and support limitations. Do not edit the shared provider registry.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

