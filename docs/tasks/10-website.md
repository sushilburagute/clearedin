# 10 — Public website and synthetic demo

Status: unassigned; no implementation started by this brief.

## Dependencies

01 and 03 accepted. Use token contract from 06; final styling waits for its exports.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [design-guidelines.md](../design-guidelines.md), [product-requirements.md](../product-requirements.md), [production-readiness.md](../production-readiness.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 10: Public website and synthetic demo in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`apps/website/` after foundation handoff; website-specific tests/assets. Shared UI remains owned by 06.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Build home, how-it-works, synthetic demo, installation/setup, privacy, FAQ/support, and changelog pages.
- Demo uses the fake classifier and real deterministic policy against synthetic fixtures, with editable category controls and reveal.
- Clearly label preview/unavailable install states until actual listings exist.
- Explain BYOK data flow, costs/limits, provider choices including Jev, uncertainty, and category overlap.
- Keep operator/contact/domain facts visibly pending in development; flag them as release blockers rather than inventing details.
- Prepare static deployment configuration and responsive metadata/accessibility checks; no publishing in this assignment.

## Acceptance criteria

- Static build passes and internal links work.
- Demo makes no provider calls and never requests credentials.
- Website bundle cannot import provider execution/credential code.
- Keyboard/zoom/reduced-motion/responsive checks cover documented widths.
- Privacy and install copy match actual support status; no unsupported accuracy or retention claims.

## Handoff

Provide built site, checks, pending factual fields, deploy instructions, and installation-link configuration. Task 13 performs final release consistency review.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

