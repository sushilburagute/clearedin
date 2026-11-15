# Security and privacy design

## Data flow and consent

ClearedIn processes rendered home-feed post text. After explicit consent, the selected provider receives minimized text and classification instructions over HTTPS. ClearedIn's website and maintainers receive no feed content or keys in the baseline design. The selected provider still processes the text; this is not offline or on-device inference.

The extension must disclose this flow before the first real post request. Show recipient, fields sent, purpose, billing implications, retention-policy link, and withdrawal control. Re-consent is required for a new recipient or expanded data scope. A browser permission prompt is not a substitute for product consent.

Minimize identity metadata, but do not claim anonymization: a post's body may itself contain names or personal information. Do not access cookies, authentication tokens, message threads, contact lists, or hidden network responses. Only process material the user has rendered on the supported feed.

## Credentials

Session-only is the initial proposal. Enter credentials in an extension-owned options page; mask by default and never expose them in content scripts, DOM attributes, query strings, console logs, or analytics. Use a trusted-context session storage facility where supported and verified. Audit access restrictions before enabling the feature; Chrome storage provides access-level controls that must be explicitly reviewed. See [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage).

A local browser profile, malicious extension update, compromised OS, or debugger may still expose a credential. A password field and client-side encryption with a bundled key do not solve that. Do not advertise “secure vault” or imply OS-keychain protection. Persistent credential storage is deferred; adding it requires a threat model, key-management design, and explicit opt-in.

Direct browser keys also conflict with general provider guidance such as [OpenAI key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety). Record a provider-specific support/security decision in phase 0. A companion service or backend alternative is a separate architectural choice, not an automatic proxy that silently receives user credentials.

## Threat model

| Threat | Required control | Residual risk |
| --- | --- | --- |
| Post prompt injection changes classification | Delimited untrusted data, narrow questions, no tools, strict output validation, deterministic policy | A model can still mislabel content; evaluate attacks and abstain conservatively. |
| Page tricks privileged code into exfiltrating keys | Isolated content scripts, no page bridge, sender/type checks, fixed provider destinations | Compromised extension code remains privileged. |
| Model output injects HTML/script | Parse schema, render labels as text, no HTML rendering/eval | Semantic misclassification remains possible. |
| Arbitrary endpoint or redirects leak authorization | Packaged endpoint allowlist; reject cross-origin redirects; no caller URLs | The selected provider receives its credential and payload by design. |
| Infinite scrolling or hostile mutations exhaust API spend | Visibility gating, debounce, queue cap, dedup, durable global request cap | Provider billing for in-flight/failed requests can differ from estimates. |
| Stale callback hides unrelated recycled node | Identity/digest/generation checks and teardown | Unknown LinkedIn DOM changes require fail-open behavior. |
| Dependency/release compromise steals data | Lockfile, dependency review, minimal permissions, protected releases, artifact audit | Store review is not a security guarantee. |
| Debugging exports disclose browsing history | Allowlisted fields only, local preview, user-triggered export | Users may manually attach sensitive screenshots; support guidance must discourage it. |

## Permission budget

Proposed required permission: `storage`. Limit content-script matching to the LinkedIn feed path and verify route checks for single-page navigation. Provider hosts are optional host permissions requested only when that provider is selected; exact TypeSafe host is determined from its verified API documentation during implementation. OpenAI and Anthropic hosts must likewise match the implemented endpoints exactly.

If reliable feed entry from another LinkedIn route requires wider injection, document the broader host access, retain strict route guards, and review the manifest diff. Do not add `<all_urls>`, cookies, history, debugger, webRequest, downloads, or native messaging permissions to the baseline. Any additional permission requires a documented feature need and security review.

Bundle all executable code. Apply a strict extension CSP, no remote scripts, no `eval`, and a narrow web-accessible-resource list. Website CSP, TLS, and dependency updates are separate controls; website scripts never collect provider keys.

## Privacy operations

No default analytics or crash-reporting SDK. Keep diagnostics local and allow export of version, browser family, adapter/model, sanitized error codes, aggregate counts, and coarse timing. Exclude post text, links, hashes, author identifiers, keys, request/response bodies, and headers. Review exports with the user before they choose to send them.

Publish an accurate privacy notice before store submission. Name the operator and contact, actual recipients, data categories, purposes, retention, local deletion, provider-side limitations, and any website hosting logs. Do not claim provider zero retention or no training unless the selected service/account configuration supports it and the claim is verified. No telemetry is added merely to satisfy product metrics.

If a key is exposed, pause requests, guide revocation at the credential issuer, remove the local key, investigate the exposure path, and require a replacement only after remediation. Never ask a user to paste their key into an issue or support conversation.
