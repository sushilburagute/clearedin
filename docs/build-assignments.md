# Subagent build assignments

This guide turns the [implementation plan](plan.md) into **13 assignable work packages**. As of 2026-11-16, task **01 is complete**, task **02 has partial feasibility evidence**, and tasks **03/04 have completed component implementations**. Task 04 production credential enablement remains gated on task 02's pending browser evidence. Tasks **05–13 remain unassigned**. See the handoffs linked below for exact validation and limitations. The canonical product, architecture, privacy, and testing specifications remain authoritative.

## Start here

Task **01 has established the foundation**. Start dependent branches from the accepted integration baseline on `main` containing their prerequisites, and consume the documented shared interfaces. Choose ready tasks from the dependency table. Each linked file contains a copy-ready assignment, exclusive file scope, deliverables, acceptance criteria, and handoff requirements.

Keep one coordinating/integration owner responsible for accepting handoffs, shared contract changes, dependency updates, and integrating branches. The user can fill that role or assign it to the parent agent. Implementers own their component tests; task 12 supplies independent system evaluation rather than becoming the first person to test the code.

## Assignment board

| ID | Work package | Prerequisites | Main output |
| --- | --- | --- | --- |
| 01 | [Foundation and contracts](tasks/01-foundation-and-contracts.md) | None | **Complete** — workspace, schemas, API boundaries, fake classifier |
| 02 | [Browser feasibility](tasks/02-browser-feasibility.md) | 01 | **Partial** — [browser evidence and pending gates](evidence/02-browser-feasibility.md) |
| 03 | [Taxonomy and policy](tasks/03-taxonomy-and-policy.md) | 01 | **Implemented** — [pure policy handoff](evidence/03-taxonomy-and-policy.md); release calibration pending |
| 04 | [Storage and credentials](tasks/04-storage-and-credentials.md) | 01, 02 | **Implemented primitives** — [storage handoff](evidence/04-storage-and-credentials.md); production credentials gated on 02 |
| 05 | [Feed DOM adapter](tasks/05-feed-dom-adapter.md) | 01, 02 | Extraction, identity, collapse/reveal/restore |
| 06 | [Extension UI](tasks/06-extension-ui.md) | 01 | Onboarding, popup, options, shared controls |
| 07 | [TypeSafe Jev](tasks/07-jev-provider.md) | 01; 03 for final semantic tests | Typed-question adapter and feasibility evidence |
| 08 | [OpenAI](tasks/08-openai-provider.md) | 01; 03 for final semantic tests | Structured-output adapter and feasibility evidence |
| 09 | [Anthropic](tasks/09-anthropic-provider.md) | 01; 03 for final semantic tests | Provider-native adapter and feasibility evidence |
| 10 | [Website](tasks/10-website.md) | 01, 03; 06 token contract | Static site and synthetic demo |
| 11 | [Runtime integration](tasks/11-runtime-integration.md) | 02–06 for fake flow; 07–09 for full flow | Working packaged extension |
| 12 | [Evaluation and hardening](tasks/12-evaluation-and-hardening.md) | 01/03 to prepare; 10/11 to finish | Independent quality and release evidence |
| 13 | [Release preparation](tasks/13-release-preparation.md) | 10–12 and release decisions | Reviewable release candidate and launch checklist |

## Practical schedule with three worker slots

These are assignment batches, not time estimates. Retain the parent/integration owner separately. An idle slot may take any task whose prerequisites are accepted; tasks need not take equal time.

1. **Foundation:** 01. Accept its shared contracts before starting consumers.
2. **First parallel batch:** 02 browser feasibility, 03 policy, 07 Jev. Jev can build transport/fixtures while 03 finishes; final category behavior must use the accepted taxonomy.
3. **Second parallel batch:** 04 storage, 06 extension UI, 08 OpenAI.
4. **Third parallel batch:** 05 DOM adapter, 09 Anthropic, 10 website. Website uses the accepted policy and UI token exports.
5. **Integration:** 11 wires the extension. In parallel, 12 may prepare the corpus and test harness in its own paths; it cannot sign off the unfinished candidate.
6. **Validation:** 12 runs the full website/extension evaluation; original owners fix reported component defects with explicit file ownership handoffs. The integration owner reruns affected integration checks.
7. **Release preparation:** 13 prepares artifacts and records gate evidence. Publication remains a separate assignment.

A wider team can start 02, 03, 06, and provider adapters after 01, then 04/05 after 02. Shared files still have one writer. A single worker can execute the same tasks in dependency order.

## How this maps to the original phases

- Phase 0 feasibility is covered by 02, the access/evidence portion of 07–09, and early corpus work in 12. Platform/distribution decisions stay with the product owner.
- Phase 1 foundation is 01. A minimal scaffold precedes some probes so they use the actual toolchain; this is a scheduling refinement, not a claim that feasibility is resolved.
- Phase 2 user control is 03–06 plus the fake-classifier milestone of 11.
- Phase 3 inference is 07–09 plus full runtime integration in 11.
- Phase 4 beta/website/quality is 10 and 12.
- Phase 5 preparation is 13. Actual deployment/store submission requires a separate launch instruction and resolved release gates.

Fixture-only work can continue while a live provider or platform question is unresolved. Do not enable, advertise, or mark a path production-ready just because its unit tests pass.

## Shared contracts and file ownership

Task 01 must export these seams before the parallel build: category/settings/consent schemas; provider input/result/error contract; policy input/output; extracted-post identity/completeness/generation; storage and reservation interfaces; typed message commands; sanitized public status; and the UI transport interface. Publish exact import paths and representative fixtures in its handoff.

The integration owner retains control of root manifests, pnpm lockfile, workspace configuration, CI, extension manifests, shared contracts, and cross-package exports after foundation. Feature agents request changes with a concrete patch/proposal; the integration owner applies them serially. Do not independently install new dependencies into a shared checkout and race on the lockfile. Prefer packages established in 01.

The provider tasks own separate subdirectories. Task 11 alone owns the registry and runtime wiring. Task 05 owns the DOM package; task 11 owns the content-script entrypoint. Task 06 owns UI/tokens; task 10 consumes them and owns website code. Task 04 owns storage primitives; task 11 owns the scheduler and is the sole production caller that writes through them. Fixtures are partitioned by task as listed in each brief.

Use the task-owned public entrypoint for each package. Contract changes require an agreed version/update and notification to affected agents; do not create a second incompatible definition locally. Use dependency injection and mocks until a prerequisite implementation lands. Mock-based completion is not end-to-end completion.

When using isolated branches/checkouts, start dependent tasks from the accepted foundation/integration commit containing their prerequisites. The coordinator chooses checkout strategy; the briefs do not authorize agents to create their own competing worktrees or new top-level threads. In a shared checkout, no branch switching, broad cleanup, or reverting another agent's work.

## Delegation wrapper

Copy the following and substitute the linked task path:

> Work in this repository on the assignment in `docs/tasks/<task-file>.md`. Read `docs/build-assignments.md` and the required specs. Implement only that task, respect file ownership, and use the accepted shared contracts. Do not spawn additional agents. Finish independent work if an external dependency is unavailable and clearly identify remaining validation. Return changed files, interfaces, commands/results, evidence, blockers, and handoff instructions. Do not publish or deploy.

Attach the accepted prerequisite commit(s) or handoff notes when delegating. No specific model/provider is required by these briefs; choose that when assigning agents. Do not give real API keys in prompts, task files, fixtures, logs, or commits. Use the available secure credential workflow for a deliberately authorized bounded live test.

## Acceptance and handoff template

Each implementation agent returns:

```text
Task:
Status: complete / partial / blocked
Prerequisite baseline:
Changed files:
Public interfaces and migration implications:
Commands run and actual results:
Browser/provider live checks: passed / failed / not run, with reason
Evidence paths:
Known limitations and remaining decisions:
Requested shared-file changes:
Next integration action:
Commit/branch, if applicable:
```

The coordinator accepts a task only when its scoped acceptance criteria are met. For partial work, accept reusable code separately from pending evidence and keep the task open. Record status updates in this assignment board or an issue tracker; never silently promote a missing browser test or unverified provider into a pass.

## Decisions agents cannot resolve by assumption

The user/product owner supplies the final name/domain, operator/support identity, commercial/license decisions, and public distribution position. The technical owner resolves supported credential custody and provider/browser combinations using feasibility evidence. Independent annotation and live API access must be arranged rather than invented. Task 13 collects these outcomes; it cannot grant platform permission, approve its own security exceptions, or claim store acceptance.

