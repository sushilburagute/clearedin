# 13 — Release packaging, operational docs, and launch preparation

Status: unassigned; no implementation started by this brief.

## Dependencies

10–12 accepted; platform/provider/privacy decisions resolved before marking public launch ready.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [production-readiness.md](../production-readiness.md), [operations-runbook.md](../operations-runbook.md), [decisions-and-open-questions.md](../decisions-and-open-questions.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 13: Release packaging, operational docs, and launch preparation in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`docs/release/`; `docs/evidence/13-release.md`; store listing/reviewer assets; release-only workflow changes with integration-owner handoff. Canonical docs updates require coordinated ownership.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Prepare reproducible tagged-build instructions, artifact checksums, manifest review, upgrade tests, and higher-version recovery procedure.
- Draft store descriptions, permission rationale, reviewer steps, synthetic screenshots, and source/build materials.
- Reconcile privacy/support/install pages with actual recipients, key handling, supported browsers/models, operator facts, and evaluation.
- Prepare static-host deployment/rollback instructions and verify placeholder release facts are resolved.
- Map every production gate to evidence and a named accountable owner; list remaining human decisions honestly.
- Prepare release ledger, incident contacts, known limitations, and changelog. This assignment prepares artifacts; it does not publish, submit, create accounts, or deploy.

## Acceptance criteria

- Both final extension packages and website correspond to the same accepted release source.
- No secrets, real-feed screenshots, remote executable code, or unsupported claims in artifacts.
- Prior-version migration/recovery is tested where a prior version exists; first release is labeled accordingly.
- Store/platform/provider decisions and applicable policies are rechecked for actual submission date.
- Every gate is passed, failed, pending, or not applicable with a reason; no inferred approval.

## Handoff

Deliver the concrete release candidate, checklist, artifacts, and exact remaining launch actions to the user/release owner. External publishing is a separate explicit assignment.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

