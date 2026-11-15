# Operations runbook

## Support and diagnostics

Before launch, assign a release owner and backup responder, publish a support channel, and define response coverage honestly. Use local status counters and user-initiated sanitized exports. The baseline has no server-side feed telemetry, so reports, store feedback, and scheduled synthetic tests are the primary signals.

Collect extension/browser version, provider/model, category settings, error code, and reproduction steps. Never request a key, private feed export, cookie, or unredacted screenshot. A synthetic reproduction is preferred. Provider request IDs may only be shared deliberately through an appropriate support process after reviewing their contents and linkage risk.

## Incident procedures

| Incident | Immediate response | Investigation and recovery |
| --- | --- | --- |
| Feed incorrectly collapses or disappears | User pauses; restore extension-owned changes | Reproduce with a synthetic DOM fixture; inspect identity/selector changes; release a higher-version fix. |
| LinkedIn markup changes | Extractor fails open and shows compatibility status | Update adapter/fixtures, run browser matrix, publish reviewed package. Do not inject remote selector code. |
| Provider outage/429 | Show posts; bounded retry/circuit breaker | Check provider status through its official channel; resume only within consent and budget. Never switch providers automatically. |
| Unexpected API spend | Pause requests; inspect local attempt totals | Verify reservations, retries, duplicate work, pricing changes, and provider billing; use provider-side controls. |
| Suspected credential exposure | Pause, revoke key at issuer, remove local credential | Identify exposure path and affected versions; fix before replacement-key use; publish accurate advisory if needed. |
| False hides after model change | Disable the affected auto-hide path or advise pause | Pin a validated model/configuration, rerun held-out evaluation, ship corrected thresholds/package. |
| Broken settings migration | Disable filtering; preserve validated non-secret state | Reproduce from old schema fixture, correct migration, ship tested recovery version. |
| Website regression | Roll back static deployment | Verify links/headers/content; installed extension remains independent. |
| Store rejection | Keep unavailable listing links honest | Address the stated policy problem; do not evade review through remote code or alternate hidden behavior. |

## Severity and communications

Treat credential leakage, unauthorized transmission, or widespread incorrect hiding as highest priority: pause rollout, preserve sanitized evidence, prepare mitigation, and document impact. Provider degradation that leaves the feed intact is lower severity but still needs a visible status. Do not promise round-the-clock response until staffing supports it.

Maintain an incident record with impact window, affected versions/providers, data involved, mitigation, root cause, verification, and follow-up owner. Avoid speculation about affected users when there is no telemetry. External notices must reflect known facts and any applicable notification obligations assessed for the actual incident.

## Routine maintenance

- Before every release: dependency/security review, manifest diff, browser-package smoke tests, provider synthetic tests, and privacy/link review.
- Weekly during beta: check feed-adapter fixtures and provider access changes; triage false-hide reports without ingesting feeds automatically.
- Monthly after launch: verify supported browser/model versions, API pricing metadata, store policies, and support documentation.
- Before any model/prompt/taxonomy change: run the full relevant evaluation and update cache/version boundaries.

Keep a release ledger with commit, artifact hashes, store versions, website deployment, model IDs, taxonomy/prompt/schema versions, evaluation links, and known issues. Credentials and raw post bodies never belong in that ledger.
