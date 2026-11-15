# 03 — Taxonomy and deterministic visibility policy

Status: implementation complete; see [handoff and validation](../evidence/03-taxonomy-and-policy.md). Provider evaluation and release calibration remain pending.

## Dependencies

01 accepted.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [classification-and-rules.md](../classification-and-rules.md), [data-contracts.md](../data-contracts.md), [product-requirements.md](../product-requirements.md).

## Copy-ready assignment

> Implement task 03: Taxonomy and deterministic visibility policy in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/taxonomy/` after foundation handoff; `packages/decision-engine/`; `packages/test-fixtures/src/policy/`.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Implement taxonomy definitions/examples and the pure visibility evaluator using frozen category IDs.
- Implement disabled/consent/route checks, per-post reveal, sufficiency/abstention/partial extraction guards, Always show precedence, and neutral Show normally.
- Merge reliable local sponsored evidence according to the documented precedence.
- Return stable reason codes and matched category IDs for deterministic UI copy.
- Support provider/model/category-specific threshold configuration. Keep experimental defaults clearly separate from evaluated release configurations.
- Supply synthetic overlap and adversarial cases for the UI, demo, and integration tests.

## Acceptance criteria

- Protect wins over hide; all categories start neutral; unknown content remains visible.
- High scores cannot override abstention or current partial extraction.
- Changing preferences re-evaluates the same classification without a remote call.
- No browser, storage, network, or provider credential dependency exists in policy code.

## Handoff

Export evaluator, taxonomy definitions, reason codes, and threshold configuration API. Freeze taxonomy/prompt-related versions before provider evaluation.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

