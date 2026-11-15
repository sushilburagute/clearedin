# Decisions and open questions

Status as of 2026-11-15. “Proposed” means a design default, not user approval or tested feasibility. The user's stated requirements are a website, a Chrome/Mozilla extension in a monorepo, category controls, BYOK, and a decision layer that may use TypeSafe Jev, OpenAI, or Anthropic.

## Decision records

| ID | Status | Decision and rationale | Consequence/revisit trigger |
| --- | --- | --- | --- |
| ADR-001 | Proposed | DOM-first extraction limits the integration to rendered posts and supports both browsers. | Selectors require maintenance. Revisit network interception only with specific evidence and a new privacy/platform review. |
| ADR-002 | Proposed | Shared WXT/React extension, Astro website, TypeScript/pnpm monorepo. | Separate browser packages and tests remain mandatory; validate tools in phase 0/1. |
| ADR-003 | Proposed | Classifiers produce categories; pure local code resolves user preferences. | Preferences change without paid inference and policies remain testable. |
| ADR-004 | Proposed | Multi-label taxonomy with Always show overriding Hide; Show normally is neutral. | Explain overlap clearly in UI; preserve precedence regressions. |
| ADR-005 | Proposed | Keep pending/uncertain/error posts visible; use reversible placeholders. | Some unwanted posts remain visible or briefly appear; prioritizes recoverability and precision. |
| ADR-006 | Provisional | Direct BYOK from extension background with session-only credentials, no ClearedIn backend. | Provider guidance/client restrictions may require a companion service or redesigned backend. Must resolve before advertising support. |
| ADR-007 | Confirmed interpretation | “Jev” means TypeSafe Jev; use a typed-question adapter. | Do not implement it as an assumed OpenAI-compatible chat endpoint. |
| ADR-008 | Proposed | Chrome feasibility first; Firefox compatibility throughout and both intended for v1. | Store timing may differ; disclose actual availability. |
| ADR-009 | Proposed | English, text-only, home feed for initial quality baseline. | Other languages/media remain visible until separately evaluated. |
| ADR-010 | Proposed | No account, cloud sync, analytics, or billing in v1. | Simplifies custody and infrastructure; revisit if business model requires services. |

## Questions that remain open

| Question | Working assumption | Needed by |
| --- | --- | --- |
| Final product name, domain, and visual identity? | ClearedIn is a working name; calm teal/neutral visual direction. | Public website/store assets |
| Which provider/model should onboarding recommend? | Support all three targets; select defaults using quality, latency, and cost evidence. | Phase 3 |
| Is session-only key entry acceptable? | Yes for prototype; validate UX and security before public claims. | Phase 0/beta |
| What platform authorization/distribution route is viable? | Unresolved; no claim of LinkedIn permission. | Public distribution |
| License and commercial model? | Undecided; no billing scope yet. | External code release/store submission |
| Initial target audience and language expansion? | English-speaking professionals, job seekers, and builders. | Evaluation corpus/beta recruitment |
| Should a preset hide categories at onboarding? | All visible by default; any preset needs an explicit preview and Apply action. | UX validation |
| Team capacity, timeline, and operating budget? | Milestones have dependency gates but no promised dates. | Delivery commitment |
| Operator, support contact, deployment host, minimum browser versions? | Assign and verify during implementation; no invented organization details. | Production checklist |

These questions do not block the documentation draft. They are decision points for implementation and release. Update this file when answered and change the canonical specification in the same commit.
