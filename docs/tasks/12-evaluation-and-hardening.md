# 12 — Independent evaluation and production hardening

Status: unassigned; no implementation started by this brief.

## Dependencies

01/03 for corpus/harness preparation; 11 and 10 for full validation. Final live metrics require provider access and accepted configuration.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [testing-and-evaluation.md](../testing-and-evaluation.md), [classification-and-rules.md](../classification-and-rules.md), [product-requirements.md](../product-requirements.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 12: Independent evaluation and production hardening in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`tests/evaluation/`; `tests/accessibility/`; `tests/performance/`; `packages/test-fixtures/src/evaluation/`; `docs/evidence/12-validation.md`. Production fixes are assigned back to component owners or explicitly transferred.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Build an evaluation harness and synthetic/permissioned corpus using the documented splits, category balance, ambiguity, and adversarial cases.
- Arrange independent annotation/adjudication through the coordinator. Do not describe one agent's generated labels as two independent human annotations.
- Measure policy outcomes, hide precision, false hides, per-category recall, abstention, coverage, latency, and usage/cost.
- Calibrate on development data only, then test held-out data and report uncertainty/sample counts.
- Test browser/OS support, accessibility, long scrolling, resource bounds, malformed input, restart, consent, and key/data isolation.
- File reproducible findings with owner and severity; verify fixes against the integrated candidate. Keep unrun matrix cells and provider tests explicitly pending.

## Acceptance criteria

- No vacuous pass from zero hides, missing denominators, or synthetic provider outputs used as live model-quality evidence.
- Release-quality evidence identifies exact code, browser/model, taxonomy/prompt, and threshold versions.
- Critical/high findings are resolved before a ready recommendation.
- All quality/performance targets have measurements or a clearly stated failed/pending state.
- A separate person/product owner resolves release decisions; the report does not invent approval.

## Handoff

Provide release recommendation, measured report, reproducible commands, blockers, and proposed validated thresholds to the integration/release owner. Do not overwrite held-out data to improve results.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

