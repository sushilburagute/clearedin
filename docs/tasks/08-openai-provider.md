# 08 — OpenAI adapter

Status: unassigned; no implementation started by this brief.

## Dependencies

01 accepted; use taxonomy from 03 for final semantic tests. Packaged live proof follows 02/11 as applicable.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [provider-integrations.md](../provider-integrations.md), [classification-and-rules.md](../classification-and-rules.md), [data-contracts.md](../data-contracts.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 08: OpenAI adapter in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/providers/src/openai/`; `packages/test-fixtures/src/providers/openai/`; `docs/evidence/08-openai.md`.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Verify current official API/model structured-output support, endpoint/auth, browser-client guidance, and billing units.
- Implement bounded classification with structured output and local schema validation. Treat model scores as self-reported.
- Handle refusals and incomplete output separately from valid classification.
- Use injected fetch/abort signal and fixed destinations; no tools, agent loops, conversation history, or automatic fallback.
- Supply synthetic fixtures and a bounded opt-in live smoke runner.
- Document the client-key security constraint and the implementation feasibility result; do not invent a server relay.

## Acceptance criteria

- Errors/refusals/partial output remain unusable for hiding.
- Unknown labels, duplicate entries, nonfinite scores, and oversized bodies are rejected.
- Input cannot override prompts or endpoint configuration; output is data only.
- Missing access/credentials is reported as pending live evidence, not successful support.

## Handoff

Export adapter plus capability metadata, tested model/API selection, required permission host, pricing verification, and unresolved access constraints. Shared registry belongs to task 11.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

