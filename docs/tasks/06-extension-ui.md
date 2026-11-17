# 06 — Extension onboarding, popup, and settings UI

Status: component implemented against injected clients and explicit synthetic mocks. See the [handoff](../evidence/06-extension-ui.md). Production messaging belongs to task 11; manual accessibility/browser validation remains pending.

## Dependencies

01 accepted; use shared mocks until 03 and 04 are integrated.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [design-guidelines.md](../design-guidelines.md), [product-requirements.md](../product-requirements.md), [data-contracts.md](../data-contracts.md), [security-and-privacy.md](../security-and-privacy.md).

## Copy-ready assignment

> Implement task 06: Extension onboarding, popup, and settings UI in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/ui/`; `apps/extension/entrypoints/popup/`; `apps/extension/entrypoints/options/`; `apps/extension/src/ui/` and their tests.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Build shared tokens/controls and accessible popup/options surfaces.
- Implement provider selection, model selection, optional host-permission request UX, masked credential entry, synthetic test trigger, consent, and enablement flow through the frozen client interface.
- Add category modes, usage limits, pause/resume, disconnect, clear-data, and sanitized diagnostic preview.
- Represent unavailable providers, pending/failed tests, unsupported routes, authentication failures, quotas, and offline operation honestly.
- Implement UI against mock transport, with a production transport adapter supplied by task 11.
- Keep website compatibility in mind for shared tokens; publish stable token/component exports early.

## Acceptance criteria

- Keyboard-only operation, meaningful labels, visible focus, zoom, reduced motion, and contrast checks pass.
- Popup can pause/resume but cannot request credentials.
- Consent is explicit; provider changes require new consent; all categories begin neutral.
- Credential values are sent only to the privileged broker and never logged or exposed in status.
- The fake transport is unmistakably test/demo-only and cannot ship as a working provider.

## Handoff

Provide surface entrypoints, transport expectations, interaction tests, and any manual accessibility evidence. Task 10 consumes shared tokens; task 11 supplies real messaging.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

