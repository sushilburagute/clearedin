# Task 02 synthetic browser probe

This isolated WXT extension uses the foundation's locked toolchain. It does not
change production entrypoints, access LinkedIn, contact providers, accept real
keys, or persist the dummy credential to disk. The only credential is a fixed
synthetic sentinel, seeded through the extension-owned options page.

Run from the repository root with Node 24.22.3 and pnpm 12.4.1 after the normal
frozen-lockfile install:

```sh
node experiments/browser-feasibility/tooling.mjs check
node experiments/browser-feasibility/tooling.mjs test
node experiments/browser-feasibility/tooling.mjs build
node experiments/browser-feasibility/tooling.mjs zip
node experiments/browser-feasibility/inspect-artifacts.mjs
node experiments/browser-feasibility/browser-runner.mjs chrome
node experiments/browser-feasibility/browser-runner.mjs firefox
```

`tooling.mjs` creates an ignored local `node_modules` junction/symlink pointing to
the existing `apps/extension/node_modules`. This experiment is deliberately not
an additional pnpm workspace. It installs no dependencies. `check` generates its
own WXT types before typechecking. `test` runs its own 24 Vitest cases, including
DOM emulation through WXT's already locked `linkedom` dependency. Root `pnpm test`
does not discover these experiment tests; run both commands.

The browser runner accepts an optional executable path as its third argument.
Defaults are the standard Windows Chrome and Firefox installation paths. It
starts headless browsers with a new temporary profile and a loopback-only fixture
server. Run the two drivers sequentially: both bind port 8765, and Firefox's
Marionette driver uses port 28765. An occupied fixture port fails instead of
silently using another server. It closes the browsers/server it started. Temporary
profiles are retained under the OS temporary directory for local investigation;
they contain no real keys and are never committed.

The driver writes sanitized checks and boolean snapshots to ignored
`results/chrome.json` and `results/firefox.json`. These contain temporary profile
paths; committed evidence removes that machine-local path. Exit **0** means all
checks and gates completed, **1** means a failed check/driver error, and **2** means
the automated checks passed with explicitly pending manual gates. Use the pinned
Node executable directly to preserve exit 2; the `npx` wrapper used on this host
maps a child exit 2 to exit 1. See the [handoff](../../docs/evidence/02-browser-feasibility.md)
and the committed [Chrome](evidence/chrome-windows.json) and
[Firefox](evidence/firefox-windows.json) runs for actual results.

## What is exercised

- Real browser content scripts on synthetic HTML, not Playwright Firefox page
  tests or DOM-emulator claims about add-on support.
- Canonical `SET_CREDENTIAL`, `CLEAR_DATA`, and `GET_PUBLIC_STATUS` request shapes
  imported from `@clearedin/contracts`. Valid ACK/status replies use the frozen
  schemas. Unsupported operations are deliberately denied by this probe.
- Browser-provided extension ID, exact options URL, top-frame/tab identity, and
  fixture URL checks. Payload-supplied surface/sender fields cannot grant access.
- A private experiment-only `PROBE_SNAPSHOT` returning capability booleans and a
  random background lifetime ID. Content cannot invoke it. `PROBE_DENIED` and
  `PROBE_UNAVAILABLE` are experiment markers, not new production IPC contracts.
- Chrome's explicit `TRUSTED_CONTEXTS` restriction before session reads/writes.
  Firefox's native privileged-only session area, with seeded content-world
  isolation checked in Firefox rather than assuming the Chrome setter exists.
- Forced background termination, changed lifetime ID, retained dummy, repeated
  content isolation and DOM tests after wake. No extension reload substitutes for
  background suspension. Natural idle timing is not measured.
- Synthetic discovery, collapse, reveal, exact restoration, generation changes
  on node reuse, stale-result rejection, and teardown. No LinkedIn selectors or
  production adapter are exported.

Manifest injection is `http://127.0.0.1/feed/*` because Firefox does not support
ports in match patterns. Both the content check and sender authorization require
the exact origin `http://127.0.0.1:8765` and pathname `/feed/`; query/fragment do not
change the pathname. `/feed/frame` and `/feed/unsupported` intentionally receive
the probe script to demonstrate sender rejection, without manipulating posts.
`all_frames` exists only for this negative iframe check.

## Remaining manual gates

The installed add-ons are development builds: Chrome loads the generated directory
through CDP `Extensions.loadUnpacked`; Firefox installs the generated ZIP
temporarily through Marionette. ZIP generation alone is not a browser test, and
these are not signed/store-installed release tests.

For interactive checks, build, run `node experiments/browser-feasibility/serve.mjs`,
and use a separate disposable browser profile. In Chrome load
`.output/chrome-mv3` through `chrome://extensions` with developer mode; in Firefox
load `.output/firefox-mv3/manifest.json` through `about:debugging`. Open this
add-on's options page through the browser's extension controls.

1. Seed the dummy and confirm `credentialConfigured: true`, `localEmpty: true`,
   and `syncEmpty: true`. Open `http://127.0.0.1:8765/feed/` and inspect the
   sanitized content report. Refresh after background termination, without
   reloading/disabling the add-on, and confirm the dummy remains isolated.
2. Request the `example.com` optional host using the button, deny the prompt,
   refresh the snapshot, and confirm `optionalHostGranted: false`. Repeat and
   grant, confirm `true`, then remove and confirm `false`. No network request is
   made. Capture browser/version and each outcome. The headless drivers currently
   verify initial absence only; they do not bypass permission prompts.
3. With an installation that persists across browser restart, seed the dummy,
   close every process for that disposable profile, reopen the same installation,
   and confirm `credentialConfigured: false` and the session facility is still
   available. Do not reload/reinstall the add-on between observations: that also
   clears session data and would invalidate this evidence. Firefox's temporary
   add-on is removed on restart; this gate requires a persistent signed test
   installation. The Chrome CDP debug installation also did not persist here.
4. Clear the dummy using the button and confirm `credentialConfigured: false`.

Do not enable production credential handling based on this probe until the
remaining gates in the handoff are resolved for the actual supported versions.
