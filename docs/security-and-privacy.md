# Security and privacy

**The preview stores local preferences and sends no feed text or credentials to a provider.** The website uses fixed examples and has no key collection or accounts. Production website builds load Google Tag Manager for Google Analytics. The extension requires only storage permission and has no provider host permissions.

## Conditions for live processing

- Review the platform and distribution position before enabling real-feed extraction. Scope extraction to rendered home-feed text. Exclude cookies, authentication tokens, private messages, contact lists, and hidden responses. [LinkedIn platform policy](https://www.linkedin.com/help/linkedin/answer/a1341387)
- Before transmission, disclose the recipient, fields sent, purpose, billing implications, and retention policy. Require explicit consent and separate permission for the selected host. Re-consent when the recipient or data scope changes. Withdrawal must stop new work and restore posts.
- Accept credentials only in extension-owned settings. The proposed store is a privileged, session-only browser area. Chrome must restrict it to trusted contexts before use. Firefox requires verified native isolation. Browser restart, actual user permission choices, and provider-specific key custody remain open. [Browser probe and evidence](../experiments/browser-feasibility/README.md)
- The three candidates use distinct APIs. Jev asks typed questions, OpenAI uses Responses, and Anthropic uses Messages. Pin each adapter to its reviewed model, endpoint, and schema. A model capability or successful Node request alone cannot establish browser support. [Jev API](https://docs.typesafe.ai/api/system-one) · [OpenAI key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) · [Anthropic SDK browser guidance](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript)

## Boundaries to preserve

The background checks browser-supplied sender identity, page URL, tab, frame, and allowed message schema. Content scripts receive public status and classification replies. Keep keys out of those replies, persisted settings, the page DOM, sync storage, and logs.

Treat post text and model output as untrusted data. Use fixed HTTPS destinations, reject redirects, omit ambient credentials, bound requests and responses, validate labels locally, and render reason text from the packaged taxonomy. Never follow a post’s instructions or silently switch recipients.

Keep classification results and sanitized diagnostics in memory. Let users preview diagnostics before sharing. Exclude post text, links, hashes, identities, credentials, headers, and raw provider responses. Clearing local data cannot erase information already sent to a provider.

Before publication, identify the operator and support contact, verify host logs and retention, and align the privacy notice, manifest permissions, and store declarations with actual behavior. A suspected credential exposure requires pausing requests, revoking the key at its issuer, and investigating the affected build. [Release and incident procedures](release/README.md)
