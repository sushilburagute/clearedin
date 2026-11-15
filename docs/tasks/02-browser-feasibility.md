# 02 — Browser and credential feasibility

Status: unassigned; no implementation started by this brief.

## Dependencies

01 accepted.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [software-architecture.md](../software-architecture.md), [security-and-privacy.md](../security-and-privacy.md), [production-readiness.md](../production-readiness.md).

## Copy-ready assignment

> Implement task 02: Browser and credential feasibility in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`experiments/browser-feasibility/`; `docs/evidence/02-browser-feasibility.md`. Production manifest changes are proposed to the integration owner, not made concurrently.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Build an isolated synthetic probe using the shared extension tooling; do not repurpose production entrypoints.
- Check Chrome and Firefox background execution, trusted session credential storage, sender metadata, optional host permissions, and worker restart behavior.
- Exercise DOM discover/collapse/reveal/restore and node reuse on synthetic fixtures to validate browser mechanics.
- Determine whether required session isolation survives worker suspension and browser restart as documented. Never silently substitute disk persistence.
- Record exact browser versions, permitted routes, manifest needs, and any platform-specific wrapper behavior.
- Produce a go/no-go recommendation for each browser's credential mechanism. Provider-specific endpoint/auth tests belong to tasks 07–09.

## Acceptance criteria

- Evidence distinguishes packaged add-on tests from ordinary page tests.
- Keys or dummy credentials cannot be retrieved through content-script/public-status paths.
- Restoration and sender checks are demonstrated on both available browser targets.
- Unavailable browser/OS combinations are explicitly untested; no fabricated parity claim.

## Handoff

Task 04 consumes the credential/lifecycle decision; tasks 05 and 11 consume browser/manifest findings. Missing feasibility evidence does not block fixture-only development but blocks enabling the unverified path.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

