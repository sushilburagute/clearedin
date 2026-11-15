# Software architecture

## Proposed stack and boundaries

Use a TypeScript monorepo with pnpm workspaces. Start with workspace scripts; add a task cache such as Turborepo only when build volume justifies it. Use WXT + React for browser extension entrypoints, Astro for the static website, shared CSS tokens, Zod or equivalent runtime schemas, Vitest for pure logic, and Playwright for Chromium integration. Firefox requires packaged add-on testing in Firefox; a Playwright Firefox page test is not proof that the extension works there.

[WXT](https://wxt.dev/guide/introduction.html) supports browser-targeted extension development. Treat generated manifests as reviewed artifacts. Chrome uses an MV3 service worker; Firefox background support differs and requires its own output and tests. See [MDN background configuration](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).

```text
apps/
  extension/           WXT entrypoints: content, background, popup, options
  website/             Astro static pages and synthetic interactive demo
packages/
  contracts/           schemas, message types, settings versions
  taxonomy/            stable category IDs, definitions, examples
  decision-engine/     pure visibility rules and precedence
  providers/           Jev, OpenAI, Anthropic adapters; background use only
  linkedin-adapter/    DOM discovery, extraction, identity, restoration
  storage/             browser persistence, migrations, cache and limits
  ui/                  React controls and CSS tokens; no provider imports
  test-fixtures/       synthetic DOM, posts, and model responses
docs/                  this documentation
```

Task 01 establishes this layout with app shells, contracts, taxonomy, and synthetic fixtures; feature packages remain implementation boundaries. See the [foundation handoff](evidence/01-foundation.md) for exact exports. Shared packages cannot depend on apps; website code cannot import credential or browser-background modules. Keep the classification pipeline independent of LinkedIn selectors so a future source adapter can reuse it.

## Runtime flow

```text
LinkedIn rendered post (untrusted)
  -> content script: extract and minimize text; keep DOM reference locally
  -> validated extension message
  -> background coordinator: consent, dedup, cache, budget, selected adapter
  -> selected provider over HTTPS
  -> schema-validated normalized category judgments
  -> deterministic local policy using current preferences
  -> content script: check identity/version, collapse or restore

Extension options -> trusted settings/credential broker -> background
Public website    -> static hosting only; no feed/key access
```

The background context owns credentials and outbound provider requests. Content scripts never receive keys, choose request URLs, or proxy arbitrary fetches. Cross-origin requests belong in the extension context with appropriate host permissions, as described by [Chrome's network guidance](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## Extraction strategy

Choose DOM extraction for v1. It limits work to rendered content and avoids dependence on undocumented private responses. Chrome `webRequest` exposes request lifecycle information but is not a general response-body reader. Firefox-specific response filtering or page-world fetch hooks would introduce a different compatibility and trust model. See the [Chrome API reference](https://developer.chrome.com/docs/extensions/reference/api/webRequest).

Use a bounded `MutationObserver` under the feed root and an `IntersectionObserver` to enqueue visible posts plus approximately one viewport of lookahead. Debounce mutations, ignore extension-owned changes, and process nodes in small batches. Stop observers on unsupported routes. Never click, scroll, or prefetch LinkedIn content.

Selectors live exclusively in the LinkedIn adapter with fixture coverage and a documented fallback order. Discover the post container, extract visible body and link-preview title, and separate visible repost context where reliable. Exclude author identity, avatars, engagement counts, comments, tracking URLs, messages, and surrounding page text. If a selector is ambiguous, skip the post.

Prefer a stable post identifier available in the DOM for local identity only. Otherwise derive an ephemeral identity. Pair identity with a normalized-content digest and a node generation counter. LinkedIn may recycle the same element for another post: restore old state, increment generation, and reject any old result. Text expansion changes the digest and permits reclassification.

## Queue, state, and restart behavior

Use one background coordinator for all tabs: initial concurrency 2, queue cap 50, one request per post, and a 10-second overall deadline per logical classification. Deduplicate concurrent requests by cache key and attach subscribers. Remove stale/offscreen subscribers and drop queued work with no subscriber. Bound provider question count and output size.

Cache normalized classifications, not final visibility. Cache identity includes content digest, extraction completeness, extractor version, taxonomy version, prompt/question version, provider, model, and adapter version. Initial cache is memory-only, LRU, max 500 entries, TTL 30 minutes. Settings changes rerun policy without invalidating classification. Provider/model or taxonomy changes invalidate incompatible entries. Check the current post's extraction completeness before applying cached results; partial extraction cannot inherit permission to hide from another post.

Background suspension is normal. Persist settings, consent, and request reservations before requests start; do not persist raw post bodies or a raw-text retry queue. Rebuild a bounded queue from still-visible posts after restart. Memory cache loss can cause another charged request; limits must remain effective. Never promise exactly-once billing where a provider offers no idempotency guarantee. [Chrome lifecycle guidance](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

Session key storage must survive ordinary worker suspension through a supported trusted-context session facility. If a supported browser cannot provide that isolation, require re-entry after background restart or change the architecture; do not fall back to plaintext disk storage silently.

## Visibility lifecycle

`discovered -> queued -> classifying -> classified -> visible | collapsed`

Any error or invalid identity transitions to visible. Pause, revoked consent, route exit, and extension-owned teardown restore content and invalidate outstanding work with an enablement generation. A result applies only if node identity, content digest, generation, and current settings are still valid. Never let a stale response re-hide a revealed post.

## Website and infrastructure

Deploy a static website to a CDN-backed host chosen during setup. Use no user accounts, database, application API, or provider gateway in v1. A feedback contact can link to a repository issue template or support address; users must be told to exclude keys and real feed captures. Website availability must not affect filtering in an installed extension.

All executable extension code, prompts, taxonomy definitions, and UI assets ship in the reviewed package. Provider responses are data only. No remote selectors or script hot patches; selector fixes require a store update. This trades faster repairs for a simpler reviewable trust boundary.
