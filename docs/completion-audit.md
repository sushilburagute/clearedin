# Repository completion audit

Audit date: 2026-11-17. **The repository is not a completed or release-ready product.** The original unit suite passed, but components had not been connected, the public website was a placeholder, the integration command deliberately failed, and high-level status documents disagreed with implemented provider/UI/DOM work.

This audit fills the independent local gaps and records unfinished production work without promoting fixture tests into live evidence. No real API key, paid provider request, real LinkedIn feed, deployment, signing, store submission, or publication was used. Pre-existing files under `artifacts/` were left untouched.

## Work completed in this audit

- Connected popup/options to a production background broker for local settings, sanitized status, reset, and diagnostics. Enforced sender identity, packaged-page matching, top-frame/feed-route restrictions, strict request schemas, serialized writes, and reply correlation. Provider and credential commands stay disabled.
- Added explicit provider registry availability and exact-endpoint network wrappers; all three existing adapters remain separate and production-gated.
- Implemented injectable classification coordination, durable attempt accounting, bounded scheduling, deduplication/cache identity, deadlines, cancellation/circuit handling, and content visibility lifecycle. Tested the actual DOM adapter and real policy with synthetic classification. These modules await production credential and browser integration.
- Built the eight planned website pages and an interactive synthetic demo with hide/protect precedence, reveal, pause/resume, and reset. Added static link/asset/metadata/control checks and prepared restrictive hosting headers.
- Replaced the integration placeholder with real local regressions and included them in CI. Added strict typechecking for integration tests.
- Added an independent-evaluation input validator and metrics CLI with Wilson intervals, leakage checks, minimum evidence gates, and honest unknown/zero-denominator results. No evaluation corpus or provider scores were invented.
- Added the release gate ledger, complete monorepo source/reviewer bundle generation, artifact SHA-256 inventory, reviewer/build/recovery instructions, and CI development artifacts. Corrected README, task status, assignment board, and testing documentation.

## Completion by work package

| Task | Current implementation | Remaining acceptance |
| --- | --- | --- |
| 01 Foundation | Implemented; workspace/contracts/checks | Final tagged reproducibility is a release gate |
| 02 Browser feasibility | Prior Chrome/Firefox synthetic probe evidence | Persistent-install browser restart; interactive optional permission grant/deny/revoke; supported-version/OS matrix |
| 03 Taxonomy/policy | Implemented and regression tested | Independent per-provider threshold calibration and held-out quality |
| 04 Storage/credentials | Implemented primitives and durable accounting | Accepted production credential facility and actual browser integration |
| 05 Feed DOM adapter | Synthetic extraction, bounded observers, reversible rendering | Permissioned/live selector compatibility and browser performance/focus evidence |
| 06 Extension UI | Components plus real local settings transport | Live setup/permission/credential flow and manual accessibility |
| 07–09 Provider adapters | Component implementations and gated registry | Bounded live endpoint/auth/model checks, browser support, credential custody decisions, calibrated thresholds |
| 10 Website | Eight static pages, synthetic policy demo, automated checks | Manual visual/accessibility review, operator/support/domain/host facts, approved install links |
| 11 Runtime | Local production broker plus injectable offline pipeline | Production coordinator/content wiring after gate acceptance; tab lifecycle and packaged-browser tests |
| 12 Evaluation | Metrics/input validator and local integration regressions | Independent annotations/corpus, held-out results, performance, security and manual browser sign-off |
| 13 Release | Source/build review bundle, hashes, ledger and instructions | Accepted clean tag/rebuild, named owners, license/distribution decision, signing, recovery exercise and release acceptance |

## Prioritized remaining gaps

1. **Credential/provider decision (blocking production inference):** resolve the task 02 browser gates and the provider-specific client-key security questions. Supply accepted evidence for each advertised browser/provider combination. See [browser feasibility](evidence/02-browser-feasibility.md) and the three adapter handoffs.
2. **Production integration (engineering):** connect the injected coordinator to broker commands with trusted credentials/permissions, connection tests, per-tab ownership and cancellation, public states, and cross-tab broadcasts. Connect the content lifecycle to verified feed roots/SPA navigation, resume/reconnect, and hidden-count reporting. Keep the existing content entrypoint inert until the supported configuration is approved. See [runtime handoff](evidence/11-runtime.md).
3. **Packaged-browser validation (engineering plus installations):** test this broker and eventual runtime in actual Chrome and Firefox packages. Existing isolated feasibility evidence does not validate new production code. Include worker/browser restart, hostile senders, pause/reset/withdrawal, tab unload, recycled nodes, focus and permission revocation.
4. **Independent evaluation (data and reviewers):** arrange two independent annotators, adjudicated synthetic/permissioned corpus, development calibration and held-out results. Do not generate a large fake corpus and call it independent evidence. Use the [evaluation tooling](evidence/12-validation.md); no evaluated threshold profiles exist yet.
5. **Manual accessibility and performance (validation):** record screen-reader/keyboard/zoom/viewport/high-contrast checks, 200-post reference-machine timing, and a 30-minute memory/scroll trace. Static markup, CSS, and short synthetic tests cannot establish these.
6. **Release facts and decisions (owner input):** final name/domain, operator/privacy/support contacts, host/log retention, license/commercial choice, platform/distribution position, publisher/signing identity, supported browser matrix, and incident owner. No release date or approval can be inferred. Track each in the [gate ledger](release/gates.json).

## Verification

The baseline had 267 passing package tests, one skipped opt-in live test, and 12 passing boundary tests. Final checks used Node **24.22.3** and pnpm **12.4.1** through the README's npx prefix. The shell's default Node 24.6.0 was not used for final acceptance. Skipped live tests and unresolved release gates remain explicit.

| Check | Actual result |
| --- | --- |
| Frozen-lockfile install | Passed; lockfile current |
| Lint and workspace dependency boundaries | Passed |
| Format check and Git whitespace check | Passed |
| Typecheck | Passed for packages, integration code/tests, extension, and website; Astro reported zero errors/warnings/hints |
| Package and script tests | 269 package tests + 16 script tests passed; one opt-in live test skipped |
| Local integration | 35 tests passed across five suites; includes resume/reveal, stale delivery, cache isolation, settings authorization, durable limits, and synthetic website interaction |
| Website build/static checks | Eight pages built; internal links/assets, anchors, metadata, labels, and preview notices passed |
| Extension builds and browser ZIPs | Chrome MV3 and Firefox MV3 passed |
| Artifact inspection | Both browser manifests and ZIP/build byte parity passed; basic secret/remote-code pattern checks passed |
| Development review bundle | Generated `.release/` source/browser/site archives and inventory; all 208 source entries and four artifact checksums independently read back and verified |
| Release gate check | **Not release-ready:** 11 pending gates; underlying command exits 2 (the npx wrapper reports shell exit 1) |
| Evaluation CLI without input | Correctly refused to fabricate results; usage message and underlying exit 2 |
| Live/provider/browser/manual performance or accessibility checks | Not run; no new acceptance evidence claimed |

The final package build exposed WXT auto-import rewriting of an injected `browser` parameter in shared storage code. Excluding all source files from auto-import transformation fixed the build while preserving explicit imports and the dependency-injected storage boundary. Browser packages were rebuilt and audited after that correction. Resume now triggers adapter rediscovery, and inference cache hashes are computed independently from minimized text rather than assuming the DOM identity digest uses the same representation.

Artifacts are a **dirty-workspace development snapshot**, not an accepted tagged release. Hosted CI was updated but was not executed remotely. Pre-existing `artifacts/` files were neither used as new evidence nor modified.

For reproduction, use the [release check sequence](release/README.md). `test:integration` is local injected/synthetic coverage. `release:check` exits 2 while gates remain pending; that is an unresolved release result, not a passing test. No public release readiness is claimed.

Detailed handoffs: [website](evidence/10-website.md), [runtime](evidence/11-runtime.md), [validation](evidence/12-validation.md), and [release](evidence/13-release.md).

## Main merge validation

Merged main at `f37c22a` into the local audit work on 2026-11-17. Consolidated the duplicate website routes/demo and sender authorization, retained the incoming 404/robots rules, dispatch regressions, provisional evaluation fixtures, and packaged validation protocols. Updated the incoming broker/scheduler regressions to exercise the current interfaces. Kept `PROVIDER_AVAILABILITY` as a compatible export of the gated registry. The provisional observation metrics have a distinct filename so module resolution cannot select the separate CLI metrics implementation.

On Node 24.22.3 and pnpm 12.4.1: frozen install, lint/boundaries, formatting, package/integration/evaluation typechecks, documentation checks, 275 package/evaluation tests (one opt-in live test skipped), 16 script tests, and 42 local integration tests passed. The website built nine pages including 404 and passed both static checkers. Chrome/Firefox builds, ZIPs, and artifact parity checks passed. These merge checks do not resolve the pending production or release gates above.
