# Source notes

Primary references checked on 2026-11-15. These establish external constraints and API concepts; they do not prove ClearedIn's implementation works. Recheck mutable policies, capabilities, model IDs, prices, and browser support before release. All product targets and stack choices in these docs are proposals.

| Reference | Used for |
| --- | --- |
| [LinkedIn prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387) | Explicit platform restriction relevant to feed appearance changes. |
| [Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests) | Background-context requests and provider host permissions. |
| [Chrome webRequest API](https://developer.chrome.com/docs/extensions/reference/api/webRequest) | Why request observation is not portable response-body extraction. |
| [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) | Restart-safe state, bounded work, and avoiding in-memory-only budgets. |
| [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) | Storage scope and trusted-context access controls. |
| [MDN background manifest configuration](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background) | Browser-specific background builds. |
| [Chrome Web Store user-data guidance](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) | Privacy disclosures and handling requirements. |
| [Mozilla add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) | Consent, disclosure, and submission review; announced December 2026 update. |
| [WXT introduction](https://wxt.dev/guide/introduction.html) | Proposed shared extension framework. |
| [TypeSafe Jev introduction](https://docs.typesafe.ai/introduction) | Typed primitives and independent questions against shared state. |
| [TypeSafe model framing](https://typesafe.ai/blog/dont-call-it-a-decision-model) | Separate model judgments from application decisions. |
| [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Schema-constrained output adapter strategy. |
| [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | Provider-specific structured output support. |
| [OpenAI API key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety) | Client-side credential limitation and architecture feasibility gate. |

No live provider request, credential test, browser-extension execution, or LinkedIn interaction was performed while drafting. External research used public documentation only.
