# 09 — Anthropic adapter

Status: unassigned; no implementation started by this brief.

## Dependencies

01 accepted; use taxonomy from 03 for final semantic tests. Packaged live proof follows 02/11 as applicable.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [provider-integrations.md](../provider-integrations.md), [classification-and-rules.md](../classification-and-rules.md), [data-contracts.md](../data-contracts.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 09: Anthropic adapter in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/providers/src/anthropic/`; `packages/test-fixtures/src/providers/anthropic/`; `docs/evidence/09-anthropic.md`.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Verify current official Anthropic model/API structured-output support, endpoint/auth, browser-client restrictions, and billing units.
- Implement a provider-native request and normalized validated result; do not assume OpenAI wire compatibility.
- Handle refusal, truncation, unsupported schemas/models, and usage fields explicitly. Mark model scores self-reported.
- Use injected fetch/abort signal and fixed destinations. Scheduling/retry/budget behavior belongs to task 11.
- Supply synthetic contract fixtures and a bounded opt-in live smoke runner.
- Export capability metadata and permission needs without changing shared registry/manifests.

## Acceptance criteria

- Provider-specific headers/body/schema are covered by fixtures.
- Invalid/refused/incomplete results cannot hide content.
- Cancellation, errors, payload limits, and response limits are enforced.
- Packaged browser success is demonstrated or explicitly untested; no bypass of provider restrictions.

## Handoff

Export adapter, supported configuration, exact model/API versions, cost-unit metadata, and feasibility evidence. Report remaining live-access needs without exposing credentials.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

