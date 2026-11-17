# Release candidate procedure

This is a development candidate, not an approved public release. Tasks 05/06, packaged-browser evidence, independent annotation, live provider feasibility, and operator decisions remain gates. No tag, store submission, signing, hosting account, or deployment is created by this procedure.

## Reproduce and retain

Use Node 24.11.x and pnpm 12.4.1. The release owner must select an accepted commit, confirm a clean checkout, and create an approved version tag only after the gate ledger is complete. From that exact checkout run:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd lint
pnpm.cmd format:check
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd docs:check
pnpm.cmd build
pnpm.cmd package:chrome
pnpm.cmd package:firefox
pnpm.cmd artifacts:check
node scripts/release-inventory.mjs
```

Archive both ZIPs, the Firefox source archive, website dist tree, lockfile, source commit, tool versions, command logs, and generated inventory together. Inventory contains SHA-256 of every website and package file and the exact Git source identity; dirty candidates are explicitly labeled. ZIP metadata may differ between rebuilds: compare unpacked bytes and manifests, not a promise of byte-identical ZIPs. Rebuild in a second clean environment before claiming reproducibility. Do not treat build success as browser execution.

Inspect generated manifests for storage, feed matching, fixed optional provider destinations, CSP, Firefox ID/data declarations, and absence of unexpected permissions. The development Firefox ID must be replaced with the operator's approved ID before submission. Review licenses, dependencies, full secret scanning, and store source requirements separately from the basic artifact pattern audit.

## Reviewer materials

Single purpose: user-controlled category filtering of rendered feed text. Draft short description: “Preview user-controlled feed category preferences with a synthetic demonstration.” Do not advertise working live filtering until the adapter/UI and browser gates pass.

Draft full description: “ClearedIn is a development preview of category-based feed filtering. Its website demonstration uses invented posts and local classification. Planned remote classification requires explicit consent and a separately billed provider credential. Uncertain posts remain visible; overlapping Always show rules take precedence over Hide. No provider/browser combination is currently advertised as production supported.”

Reviewer steps: build from the recorded source; load Chrome unpacked output or Firefox temporary add-on; inspect the preview status and options; visit the built website demo; change a category to Hide, exercise reveal, and verify Always show precedence. Capture only synthetic material. Packaged real-feed controls are pending task 05/06; reviewers must not be instructed to enter credentials into an unavailable path. Store screenshots and real packaged accessibility evidence remain pending, not fabricated.

Permission rationale: storage persists validated preferences and aggregate request reservations where wired. Feed content-script matching is limited to the supported route. Provider host permissions must remain absent or unavailable until each fixed endpoint and consent flow is validated. No cookies, history, debugger, arbitrary hosts, or remote code are justified.

## Deploy and recover

Deploy only the retained website dist from the same accepted commit as both packages. Choose the host/domain, HTTPS, canonical URLs, cache behavior, CSP and other security headers before deployment. Verify all internal links, 404 handling, preview indexing restrictions, privacy/support facts and approved installation URLs. Preserve the previous immutable deployment; rollback by switching the host to it and rechecking links and headers. No provider secrets are build variables.

First release: no previously distributed version is recorded, so prior-version migration is not applicable yet; fresh install, restart, clear-data, and storage schema recovery still require evidence. For later releases, test fixtures from every supported schema and an actual previous package. Extension rollback uses a higher version containing reverted code with compatible migrations. Never assume store downgrades work. Exercise recovery in both browsers before rollout.

Incident responder and backup: UNASSIGNED. Support address and coverage: PENDING. On unauthorized transmission or key exposure pause rollout, advise pause/disable and issuer-side revocation, preserve sanitized evidence, fix and verify before replacement credentials. Follow the operations runbook; never solicit keys or real-feed dumps.
