# Security and privacy

The website demo uses fixed examples and has no key collection or accounts. The extension stores preferences locally. Its connection test sends a packaged sample with the user's key to the selected provider. Feed classification requires a separate opt-in and enablement. The browser sends post text, classification instructions and an authentication header directly to that provider. The provider receives the user's network address as part of the connection.

## Conditions for live processing

- The product owner specified opt-in processing of the installing user’s desktop home feed. Content scripts match the top-level home feed, skip recognized sponsored posts, and read only the rendered post fields used by the classifier. The selected provider receives the user's own API key for authentication. LinkedIn credentials, cookies and private messages are outside the integration. Public distribution remains a separate decision. [LinkedIn platform policy](https://www.linkedin.com/help/linkedin/answer/a1341387)
- Before transmission, disclose the recipient, fields sent, purpose, billing implications, and retention policy. Require explicit consent and separate permission for the selected host. Re-consent when the recipient or data scope changes. Withdrawal must stop new work and restore posts.
- Credentials enter through extension-owned settings and stay in privileged browser-session storage. Chrome explicitly restricts session access to trusted contexts. Firefox uses its privileged session area. Users re-enter keys after closing the browser. Privileged extension code can access the key, and providers receive it for authentication. Public-release checks cover persistent installs, restart and native permission choices. [Browser probe and evidence](../experiments/browser-feasibility/README.md)
- The three candidates use distinct APIs. Jev asks typed questions, OpenAI uses Responses, and Anthropic uses Messages. Pin each adapter to its reviewed model, endpoint, and schema. A model capability or successful Node request alone cannot establish browser support. [Jev API](https://docs.typesafe.ai/api/system-one) · [OpenAI key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) · [Anthropic SDK browser guidance](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript)

## Boundaries to preserve

The background checks browser-supplied sender identity, page URL, tab, frame, and allowed message schema. Content scripts receive public status and classification replies. Keep keys out of those replies, persisted settings, the page DOM, sync storage, and logs.

Treat post text and model output as untrusted data. Use fixed HTTPS destinations, reject redirects, omit ambient credentials, bound requests and responses, validate labels locally, and render reason text from the packaged taxonomy. Never follow a post’s instructions or silently switch recipients.

Keep classification results and sanitized diagnostics in memory. Let users preview diagnostics before sharing. Exclude post text, links, hashes, identities, credentials, headers, and raw provider responses. Clearing local data cannot erase information already sent to a provider.

Before publication, identify the operator and support contact, verify host logs and retention, and align the privacy notice, manifest permissions, and store declarations with actual behavior. A suspected credential exposure requires pausing requests, revoking the key at its issuer, and investigating the affected build. [Release and incident procedures](release/README.md)
