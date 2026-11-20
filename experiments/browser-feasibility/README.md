# Browser feasibility probe

This isolated WXT extension uses a fixed dummy credential and a loopback feed. For the shipping extension’s settings checks, use the [packaged-browser instructions](../../docs/testing-and-evaluation.md#browser-checks).

## Run the probe

After the root frozen-lockfile install, run these from the repository root. The tooling reuses the extension’s locked dependencies through a local junction or symlink. Run the probe tests separately from `pnpm test`.

```sh
node experiments/browser-feasibility/tooling.mjs check
node experiments/browser-feasibility/tooling.mjs test
node experiments/browser-feasibility/tooling.mjs build
node experiments/browser-feasibility/tooling.mjs zip
node experiments/browser-feasibility/inspect-artifacts.mjs
node experiments/browser-feasibility/browser-runner.mjs chrome
node experiments/browser-feasibility/browser-runner.mjs firefox
```

Run the browsers sequentially. The fixture uses port 8765 and Firefox Marionette uses port 28765. Defaults use standard Windows browser paths. Pass an executable path after the browser name to override. Each run starts a disposable profile and writes results to the ignored `results/` directory. Exit 1 indicates a failed check and exit 2 indicates outstanding manual checks.

On Windows, Chrome 157.0.8103.51 and Firefox 160.0 isolated the seeded dummy from content scripts and retained it across background termination. Chrome used `TRUSTED_CONTEXTS`. Firefox used its native privileged-only session area. The local and sync areas stayed empty. [Chrome results](evidence/chrome-windows.json) · [Firefox results](evidence/firefox-windows.json) · [Artifact hashes](evidence/artifacts.json)

## Remaining manual gates

1. Run `node experiments/browser-feasibility/serve.mjs`. In a disposable profile, load the probe’s `.output/chrome-mv3` directory or `.output/firefox-mv3/manifest.json`. Seed the dummy in options, verify local and sync storage stay empty, and inspect the sanitized report at `http://127.0.0.1:8765/feed/`.
2. Use the options button to request the optional example.com host. Deny, grant, then revoke access, refreshing the snapshot to verify each state.
3. Use an installation that persists across a full browser restart. Seed the dummy, close every process for that profile, and reopen the same installation. Verify that the credential is absent and the trusted facility remains available. Reloading or reinstalling also clears session data and invalidates this check. Firefox requires a persistent signed test installation for this step.
4. Verify explicit clearing and record browser version and outcomes before making a production credential decision.
