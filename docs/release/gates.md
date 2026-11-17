# Release gate ledger

Candidate: development source; record the accepted commit when reviewing. Public launch recommendation: NOT READY. The authoritative machine-readable status is in [gates.json](gates.json). Accountable roles below are unassigned; actual people must be named before approval. No approval is inferred.

| Gate | State | Evidence / remaining action | Accountable owner |
| --- | --- | --- | --- |
| Platform position | pending | Product owner records distribution/legal decision; recheck applicable policy on actual submission date | Product owner: UNASSIGNED |
| Provider feasibility | pending | Evidence 02 and 07–09; live/browser and credential custody decisions outstanding; no supported remote configuration advertised | Technical lead: UNASSIGNED |
| Product scope | pending | Tasks 05/06 have synthetic-tested components; production wiring and packaged feed stories remain unaccepted | Product owner: UNASSIGNED |
| Quality | pending | Task 12 synthetic regression harness; independent human annotation and live held-out metrics outstanding | QA owner: UNASSIGNED |
| Security | pending | Basic artifact checks do not replace dependency/license/threat review or comprehensive secret scan | Security owner: UNASSIGNED |
| Privacy | pending | Operator, support, provider custody and actual host logs unresolved | Privacy owner: UNASSIGNED |
| Accessibility | pending | Packaged keyboard/screen reader/zoom/reduced-motion checks not run | Design/QA owner: UNASSIGNED |
| Build integrity | pending | Local build/checks recorded in evidence 13; accepted clean tag and second-environment reproduction required | Release owner: UNASSIGNED |
| Store packages | pending | Unsigned development packages only; actual packaged-browser execution, signing and reviewer screenshots outstanding | Release owner: UNASSIGNED |
| Website | pending | Static preview; deployment HTTPS/headers/domain, contact facts and listings unresolved | Web owner: UNASSIGNED |
| Operations | pending | Runbook prepared; named responder, backup and recovery exercise outstanding | Release owner: UNASSIGNED |
| Prior release migration | not applicable | No prior distributed release recorded; fresh install and recovery tests still required | Release owner: UNASSIGNED |

## Release ledger fields

Record accepted commit/tag, extension versions, website deployment ID, exact browser/OS and provider/model versions, prompt/taxonomy/schema and threshold versions, hashes from release-inventory.json, evaluation report, signed artifact IDs, known limitations, gate approvals with names/dates, responder and backup. Do not include post bodies, identity hashes, request headers or credentials.

## Development changelog

- Added public static preview pages and deterministic synthetic category demo.
- Added runtime integration primitives and conservative provider availability gates.
- Added synthetic evaluation corpus and metrics checks with explicit missing live-quality evidence.
- Prepared reproducible build inventory, reviewer copy, deployment/recovery procedure and gate ledger.

These entries describe implementation scope, not accepted end-to-end functionality or release approval.
