# Task 02 browser and credential feasibility handoff

Status: **partial feasibility acceptance**. The isolated implementation and all available automated checks are complete. Persistent-install browser restart and interactive optional-host permission gates remain open. Do not enable the production credential path on the strength of this report alone.

Run date: 2026-11-16 IST (2026-11-15 UTC). Prerequisite: task 01 is merged in `e475aeb`, including implementation `edc4707` and its [accepted foundation handoff](01-foundation.md). Branch: `feat/02-browser-feasibility`. The implementation commit includes this report and the sanitized evidence together.

## Scope and artifacts

All implementation changes are inside [experiments/browser-feasibility](../../experiments/browser-feasibility/README.md). This report is the only change outside that directory. Production manifests, root workspace/lockfile, shared contracts, task 04 storage, and task 05 adapter are unchanged. No provider credentials, provider requests, LinkedIn pages, publishing, or deployment were used.

Changed files and roles:

- `wxt.config.ts`, `package.json`, `tsconfig.json`, `tooling.mjs`, and `vitest.config.ts`: isolated WXT build/check/test configuration reusing task 01's locked installation through an ignored local modules junction; no dependency installation or new workspace.
- `entrypoints/background.ts`, `content.ts`, and `options/`: dummy-only credential broker, actual browser sender checks, strict shared status/ACK schemas, content isolation checks, and manual permission controls.
- `src/session.ts`, `authorization.ts`, `routes.ts`, and `dom.ts`: experiment-local session/authorization/DOM mechanics, with unit tests in `tests/`.
- `fixtures/feed.html`, `serve.mjs`, and `browser-runner.mjs`: loopback synthetic fixture and dependency-free CDP/Marionette drivers using disposable profiles.
- `inspect-artifacts.mjs`, `README.md`, and `evidence/`: manifest/content-bundle checks, reproduction/manual instructions, and committed run snapshots.

Committed actual results: [Chrome Windows](../../experiments/browser-feasibility/evidence/chrome-windows.json), [Firefox Windows](../../experiments/browser-feasibility/evidence/firefox-windows.json), and [artifact SHA-256 hashes](../../experiments/browser-feasibility/evidence/artifacts.json). Snapshots contain booleans, synthetic checks, random background lifetime IDs, and pending gates, with temporary profile paths removed. Generated outputs and local result files are ignored.

## Browser evidence matrix

Host: Microsoft Windows 11 Home Single Language, version `10.0.26200`, x64. Node `24.22.3`, pnpm `12.4.1`, WXT `0.21.5`, Vite `8.3.8`. Browser versions were read from the running automation sessions, not inferred from the package target.

| Check | Chrome 157.0.8103.51 | Firefox 160.0 |
| --- | --- | --- |
| Installed add-on tested | WXT production build directory loaded by CDP `Extensions.loadUnpacked` | WXT Firefox ZIP installed temporarily by Marionette `Addon:Install` |
| Background implementation | MV3 service worker | MV3 event page via generated `background.scripts` |
| Dummy seeded in trusted session area | Pass | Pass |
| Explicit `setAccessLevel` API | Present; awaited `TRUSTED_CONTEXTS` before reads/writes | Absent; native privileged-only session area tested directly |
| Content direct session read with dummy present | Denied/unavailable; dummy not returned | Denied/unavailable; dummy not returned |
| Public status | Shared strict schema validates; boolean availability only | Same check passed in Firefox |
| Options-only commands from content | SET_CREDENTIAL, GET_SETTINGS, CLEAR_DATA, TEST_PROVIDER_CONNECTION and private snapshot denied | Same checks passed in Firefox |
| Unsupported route and iframe senders | Denied using real browser metadata | Same checks passed in Firefox |
| Synthetic discover/collapse/reveal/restore | Pass, including exact markup restoration and stale reuse | Same checks passed in Firefox |
| Forced background termination | CDP `ServiceWorker.stopAllWorkers`; lifetime ID changed | Firefox test-only `extension.terminateBackground()`; lifetime ID changed |
| Session after background termination | Dummy retained; content isolation and DOM suite repeated successfully | Same checks passed after event-page wake |
| `storage.local` / `storage.sync` | Empty during trusted snapshots | Empty during trusted snapshots |
| Optional `example.com` host initially absent | Pass | Pass |
| Interactive optional host grant/deny/revoke | **Not run** in headless driver | **Not run** in headless driver |
| Full browser restart, same installed add-on | **Not established**: CDP debug installation did not persist on relaunch; deliberately not reinstalled to manufacture an empty-store result | **Not run**: temporary add-on is removed on restart; needs persistent signed test installation |
| Automated browser checks | **24 passed; driver exit 2** for pending gates | **24 passed; driver exit 2** for pending gates |

These are actual extension contexts on built add-ons, not ordinary page tests. The separate 24 Vitest cases use mocks and `linkedom`; their background/browser restart cases model the storage lifetime and are not live browser restart evidence. Browser ZIP generation, compilation, and manifest inspection are also not runtime evidence.

macOS, Linux, other Chrome/Firefox versions, Firefox ESR/minimum 140, signed/store installations, private/incognito contexts, mobile browsers, natural idle termination timing, crash recovery, and extension update/reload transitions are **untested**. No cross-platform or minimum-version parity is claimed.

## Credential decision for task 04

**Chrome: GO for fixture development using trusted `storage.session`; NO-GO for production enablement until the remaining restart and permission gates are accepted.** The tested mechanism survives an actual worker stop while staying inaccessible to a seeded content script. Await `storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })` before storing or reading credentials; failure must make the capability unavailable. A newly constructed background store can reuse the browser-owned session area. Do not use worker-global memory alone for suspension resilience.

**Firefox: GO for fixture development using native privileged-only `storage.session`; NO-GO for production enablement until the remaining restart and permission gates are accepted.** Firefox 160 has the session area but no Chrome-style access-level setter. Requiring that method unconditionally initially made the probe unavailable. The browser-specific probe now tests Firefox's native default isolation, and a seeded content script could not retrieve the dummy before or after event-page termination. Do not call or emulate a nonexistent setter, and do not infer support for Firefox 140/ESR from this 160 result.

The [Chrome storage documentation](https://developer.chrome.com/docs/extensions/reference/api/storage) describes session data as in-memory, unavailable to content scripts by default, and cleared on browser restart, extension disable, reload, or update. [MDN's session documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/session) describes in-memory browser-session storage with a privileged default. These documented semantics support the proposed mechanism; they do **not** replace the unperformed persistent-install restart check. Session isolation should survive the restart; the credential itself should be absent and require re-entry.

Never silently substitute `storage.local`, `storage.sync`, IndexedDB, Web Storage, an offscreen document, a disk queue, or an encrypted value with a bundled key. The experiment session helper has no persistent-storage port. If a target cannot demonstrate the required facility, keep it unavailable or explicitly require credential re-entry after background restart, with a documented product decision.

The frozen `BrowserCapabilities` facts demonstrated for these exact Windows builds are `trustedSessionStorage: true` and `sessionSurvivesBackgroundRestart: true` for each family. Those are evidence facts for the tested builds, **not** permission to hard-code production capabilities for all versions. Task 04 should use the nullable `BrowserPorts.trustedSessionStorage` boundary and preserve `CredentialStore` unchanged. These experiment helpers are not a production credential store and export no cross-package API or migration.

## Browser/manifest handoff for tasks 05 and 11

The probe's generated manifests have required `storage`, no `host_permissions`, optional `https://example.com/*`, strict local-code CSP, no externally connectable interface, no web-accessible resources, and no provider/LinkedIn origins. `example.com` is an inert permission target only; no request is sent there.

Production manifest proposal, to be applied serially by the integration owner after gate acceptance:

1. Add only required `storage`; retain feed-scoped production injection. No `tabs`, debugger, cookies, history, webRequest, native messaging, or all-URL permission is needed by the demonstrated runtime mechanism. CDP/Marionette control is test infrastructure, not an extension permission.
2. Add exact optional provider origin patterns only after tasks 07–09 verify their endpoints. The example origin and loopback fixture must never enter the production manifest. Permission prompts still require separate product consent.
3. Keep Chrome `background.service_worker` and Firefox `background.scripts`; consume WXT's generated browser-specific output. [MDN background configuration](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background) documents the differing runtime implementations. No service-worker parity assumption is needed for the shared storage port.
4. Preserve exact packaged options-page sender checks using `runtime.getURL`, the browser-supplied extension ID, and top-frame information. An options page can have a tab ID, so rejecting every tab-bearing sender would reject valid options. Content must additionally have a real tab, frame 0, and an allowed route; payload `surface`, `sender`, URL, or credential fields cannot grant privileges. Runtime schemas alone are not authorization.
5. Do not copy the probe's `all_frames: true` into production. It exists to demonstrate iframe rejection. The probe match is `http://127.0.0.1/feed/*` with an exact runtime origin/port guard; [Firefox match patterns do not support port numbers](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns). An initial port-bearing pattern failed to inject on Firefox, and changing it made the real content suite run.
6. The probe permits only `http://127.0.0.1:8765/feed/` for top-level content authorization. `/feed/frame` and `/feed/unsupported` receive the injected test script but their messages are rejected. Tasks 05/11 must supply their own production route guards and SPA lifecycle tests; these synthetic routes do not establish live LinkedIn support.
7. Retain identity plus content/generation checks, restore before accepting recycled nodes, and preserve revealed state against late callbacks. A collapsed node losing its identity must restore immediately. The experiment manipulates only a synthetic body's hidden attribute and an owned reveal button; task 05 still owns the actual adapter, selectors, observers, health checks, route exit/pause/consent integration, and performance limits.

`wxt/browser` provided Promise-based messaging/storage in both generated builds. Background listeners register synchronously and await session initialization inside their handlers, preventing an early-write race. Firefox automation required process-local `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` for its test-only privileged Marionette operations; this is not a product requirement. The test runner uses isolated profiles and never changes the user's browser settings.

## Commands and actual results

Commands below used Node 24.22.3. The shell default was 24.6.0, so standard checks used the README's `npx --yes --package=node@24.22.3` prefix (and pnpm 12.4.1). Browser drivers were then invoked with that resolved pinned Node executable directly to preserve their partial exit status; this host's `npx` wrapper maps child exit 2 to 1.

| Command | Actual result |
| --- | --- |
| `node experiments/browser-feasibility/tooling.mjs check` | Pass; WXT types generated and strict experiment typecheck |
| `node experiments/browser-feasibility/tooling.mjs test` | Pass; 24 tests in 3 files |
| `node experiments/browser-feasibility/tooling.mjs build` | Pass; separate Chrome/Firefox MV3 outputs |
| `node experiments/browser-feasibility/tooling.mjs zip` | Pass; browser archives and experiment-local source archive; local results excluded |
| `node experiments/browser-feasibility/inspect-artifacts.mjs` | Pass; permission/CSP/background/match checks, dummy literal absent from content bundles, ZIP/manifest hashes recorded; not a ZIP byte-parity audit |
| `node experiments/browser-feasibility/browser-runner.mjs chrome` | 24 passed; **exit 2**, persistent restart and interactive permission checks pending |
| `node experiments/browser-feasibility/browser-runner.mjs firefox` | 24 passed using Firefox ZIP; **exit 2**, persistent restart and interactive permission checks pending |
| `pnpm typecheck` | Pass; packages, production extension and website |
| `pnpm test` | Pass; 34 package tests + 12 boundary guard tests = 46 |
| `pnpm lint` | Pass; includes experiment source and workspace boundaries |
| `pnpm format:check` | Pass |
| `pnpm docs:check` | Pass; includes this evidence report |
| Root `pnpm test:integration` | Not run or replaced; the task 01 NOT IMPLEMENTED placeholder remains unchanged |
| Hosted CI, provider tests, live LinkedIn, release/store checks | Not run |

Browser testing used the final built extension outputs. Earlier exploratory runs found the Chrome-only storage method assumption, Firefox port-pattern mismatch, and nonpersistent debug installations; the final committed results distinguish corrected automated checks from still-open gates.

## Remaining acceptance and next integration actions

1. Accept the local probe and both browsers' demonstrated sender/restoration/background-suspension evidence separately from full feasibility sign-off. Task 02 remains partial until its pending browser gates are accepted; do not silently mark the assignment board complete.
2. Follow the [manual protocol](../../experiments/browser-feasibility/README.md#remaining-manual-gates) with installations that survive a complete browser restart. Verify the dummy is absent, trusted isolation remains, and re-entry works, without reload/reinstall confounds. Firefox needs a persistent signed test add-on; Chrome needs a persistent development/store installation.
3. Record real optional permission grant, denial, and revocation for both browser versions. Headless initial absence and a working manifest are insufficient prompt evidence.
4. Task 04 can implement against the accepted contracts using fixtures and the browser-specific session decision. Task 05 can implement fixture-only DOM mechanics. Task 11 can prepare manifest changes and fake-runtime wiring, keeping unverified credential paths disabled until gates close. No shared-file patch was applied concurrently.
5. Before widening support, repeat the packaged tests and manual gates on each claimed browser/version/OS. Provider-specific endpoint/auth and direct-browser credential support decisions remain tasks 07–09.
