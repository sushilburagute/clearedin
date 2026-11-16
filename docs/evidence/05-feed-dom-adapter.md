# Task 05 feed DOM adapter handoff

Status: **component implemented and synthetic-tested; live LinkedIn compatibility unverified**. Date: 2026-11-16. Baseline: `14348e8` on `main`, including the accepted foundation and policy/storage components and task 02's [partial browser feasibility](02-browser-feasibility.md). Branch: `feat/feed-adapter-extension-ui`; isolated worktree: `.worktrees/feed-adapter-extension-ui`. No production content-script wiring, provider requests, credential handling, publishing, or deployment is included.

## Files and interfaces

- `packages/linkedin-adapter/src/{index,adapter,extraction,render}.ts` implements the frozen `ExtractionAdapter` and callbacks from `@clearedin/contracts`.
- `@clearedin/linkedin-adapter` exports `createLinkedInAdapter`, `EXTRACTOR_VERSION`, `supportsFeedRoute`, `extractPostContent`, `SELECTORS`, and the `LinkedInAdapter`, `AdapterOptions`, `ObserverPorts`, and `ExtractedContent` types.
- `createLinkedInAdapter(options?)` returns `observe(root, callbacks, signal)`, `apply(identity, decision)`, `restore(identity)`, `restoreAll()`, and `dispose()`, plus local `discover()`, `extract(node)`, `reveal(identity)`, and `routeChanged()` helpers. Nodes never cross this boundary into messages. Hashing, scheduling, observer constructors, and URL reads are injectable for deterministic tests; production defaults use browser facilities.
- `packages/test-fixtures/src/dom/index.ts`, exported through `@clearedin/test-fixtures/dom`, contains wholly synthetic feed/repost markup. `packages/linkedin-adapter/tests/adapter.test.ts` has 25 extraction/lifecycle regressions. Coordinated manifest/lock changes reuse already-locked `linkedom@0.18.15` for tests and taxonomy labels for placeholders. The boundary allowlist permits the adapter's synthetic fixture dependency. No shared schema or contract changed.

## Extraction and lifecycle

Only the exact HTTPS `www.linkedin.com` origin with `/feed` or `/feed/` subpaths is supported. The caller supplies a connected feed root under `main`: `[role="feed"]` or `.scaffold-finite-scroll__content`. Recognized post containers are `.feed-shared-update-v2`. The modern `.update-components-text` body and legacy `.feed-shared-update-v2__description` body are alternatives; multiple matching bodies outside a single recognizable quote are ambiguous and fail open. Link-preview text is limited to `.feed-shared-article__title`, and quote context to `.feed-shared-update-v2__reshared-content`.

The adapter reads selected visible text regions, excluding author blocks, comments, messages, controls, hidden text, counters, extension nodes, and URL strings. It never reads link destinations. Text is whitespace-normalized and bounded to 8,000 characters. Truncation controls, ellipses, missing text, image-only material, inaccessible quotes, or an exceeded text bound mark extraction partial. More than 2,000 element nodes or ambiguous regions invalidate extraction. Only a single exact, visible outer `Sponsored` or `Promoted` actor disclosure supplies the English-only local sponsored flag. Other/localized or quoted markers do not qualify. These are **selector assumptions supported by fixtures, not verified live selectors**.

Discovery walks at most 200 elements and processes at most 20 candidates per scheduled batch, with 32 ms scheduling, at most 100 pending roots/posts, and at most 250 tracked candidates. Intersection observation uses one viewport of vertical lookahead. New candidates are observed before reading/hashing their text; only intersecting candidates emit `onPost`. Offscreen subscriptions emit `onRemoved`. Overload/ambiguity/hashing failures report unhealthy and restore content; recovery requires coordinator re-observation. These are structural bounds, not measured scroll-performance or 30-minute retention evidence.

Each local identity combines a validated DOM URN when available (otherwise an ephemeral ID), a unique node-instance suffix, SHA-256 digest, and monotonically increasing generation. Digest input includes normalized text, completeness, local sponsored evidence, and repost context. None of the local identity/digest material is provider input. DOM/content/body-node checks run again after asynchronous hashing and synchronously before applying a result. Recycled IDs, text expansion, replaced bodies, and detach invalidate old identities. Duplicate source IDs remain distinct instances.

Collapse hides the whole host post with `hidden`, `inert`, `aria-hidden`, and an important display rule, preserving host nodes/listeners. A separate Shadow DOM placeholder exposes a named native Show button and details with matched rules. Reveal restores exact original attribute/style strings and preserves focus when invoked from the placeholder. A single polite live region announces user-triggered reveal. Focus inside the post defers collapse until focus leaves. Reveal overrides survive text expansion, rescanning, and `restoreAll()`/rediscovery during the page session. Without a stable source ID, an override conservatively protects the node lifetime rather than risking unwanted hiding. Disposal/route exit clears overrides. `restoreAll()` retires outstanding identities so pre-pause results cannot re-hide content.

## Validation and limits

Windows, Node 24.22.3, pnpm 12.4.1, in the isolated worktree:

| Command | Actual result |
| --- | --- |
| `pnpm install --offline --frozen-lockfile` | Pass; independent workspace links, no new package downloads |
| `pnpm exec vitest run packages/linkedin-adapter/tests` | Pass: 25 synthetic DOM tests |
| Repository lint, format, typecheck, tests, builds and artifact checks | See [combined UI/DOM validation](06-extension-ui.md#repository-validation) |

Tests cover privacy exclusions, quoted context, partial and oversized trees/text, sponsored markers, missing/duplicate IDs, visibility before hashing, native hidden posts, stale results before observer debounce, reveal/expansion/pause, focus deferral, attribute/markup/listener restoration, detached nodes, old disposers, async digest completion after abort, routes, overload, extension mutations, and observer/timer teardown. `linkedom` is a synthetic DOM; observers, geometric intersection, focus, and time are injected. This does not establish native tab order, screen-reader output, layout, browser focus behavior, or live selector compatibility.

No live LinkedIn page, provider, packaged-extension UI, manual accessibility session, or performance trace was tested. In particular, hidden/inert assertions are not claimed as browser keyboard testing. Task 02's pending browser gates remain pending.

## Task 11 integration actions

1. Construct the adapter only after strict route/consent/runtime checks. Resolve a unique, supported feed root; never widen scanning into private routes. Call `routeChanged()` synchronously from the SPA navigation hook; the 500 ms route/detach poll is fallback cleanup, not permission to classify after navigation. Re-observe on a new supported feed root.
2. Map `onPost`/`onRemoved` to subscriptions and cancel them when removed/offscreen. Retain enablement/settings generations in the coordinator and validate them before invoking `apply`; the DOM adapter cannot know current consent or policy settings.
3. Supply evaluated policy decisions, retaining current extraction completeness and the independent local sponsored flag. `apply` refuses remote hiding of partial content even if passed a collapse decision. Errors/unsupported/unhealthy state remain visible.
4. Use `restoreAll()` to pause and retire results while preserving page-session reveals. Use `dispose()` on reset/route exit to clear reveal memory and release all resources. Provider/model details are intentionally not passed through the frozen visibility interface; placeholders direct users to settings for those details. Add any richer disclosure via an agreed integration contract rather than inventing one in the DOM package.
5. Demonstrate real selectors, focus/tab order, reveal and pause restoration, SPA navigation, recycling, and performance in both packaged browsers before claiming compatibility or production readiness.
