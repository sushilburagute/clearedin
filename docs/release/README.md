# Development review and release preparation

This is a development review package, not an approved release candidate. See the [gap audit](../completion-audit.md) and [gate ledger](gates.json). No store listing, domain, operator identity, support contact, license choice, provider credential decision, or public distribution approval is invented here.

## Reproduce and inspect

Use Node 24.22.3 and pnpm 12.4.1, the committed lockfile, and the same accepted source for every artifact:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm site:check
pnpm docs:check
pnpm build
pnpm package:chrome
pnpm package:firefox
pnpm artifacts:check
pnpm release:prepare
pnpm release:check
```

The final command exits 2 while launch gates remain unresolved; do not mask it in a release job. CI's passing development checks are separate. `.release/inventory.json` records artifact/source SHA-256 values, current commit, dirty state, and Node version. Unzip `repository-source.zip` to a new directory, install with the frozen lockfile, and reproduce both browser builds and the site. An independent clean-tag rebuild remains required before submission. The source ZIP contains no `.git`; release preparation itself requires a Git checkout, but builds do not.

## Reviewer walkthrough

1. Use a disposable development browser profile. Inspect the generated Chrome/Firefox manifests: storage permission, feed-scoped inert content script, local-code CSP, no provider host permissions or remote executable code.
2. Open extension options. Confirm all providers are unavailable and credential entry is disabled. Change a category and daily limit, save, close/reopen options, and check persistence. Recreate the background context and repeat. Clear all data and verify defaults return. These manual checks must be recorded; local tests do not establish browser behavior.
3. Open the explicitly labelled synthetic UI demo. It simulates setup in memory without accepting a key. Exit to discard its changes. Confirm it has not changed persistent settings.
4. Build/open the static website locally using the website dev command. Use the synthetic demo to hide engagement bait, hide product launches, protect technical content, reveal, pause, and reset. Check keyboard focus, screen-reader labels, 200% zoom, widths 360/768/1440px, dark mode, reduced motion, and forced colors. Record outcomes; no manual passes are claimed yet.
5. Confirm no live feed is altered and no provider traffic occurs. Do not use real API credentials or real-feed screenshots in reviewer materials.

Draft development listing: “ClearedIn is a development preview of user-controlled feed category rules. Explore a synthetic demonstration and save local preferences. Live filtering and provider connections are not available.” This wording is for review only; final store copy must match the supported release and approved privacy disclosure.

Permission rationale: `storage` persists non-secret category preferences, limits, and future conservative request accounting. It does not authorize provider access. Feed matches are reserved for the currently inert content entrypoint. A future provider-enabled package needs exact optional origins, final disclosures, and renewed review.

## Website deployment and rollback

No deployment is performed. Once a host/domain/operator is accepted, publish only `apps/website/dist/` from the same reviewed source. Apply `public/_headers` where supported, otherwise configure equivalent HTTP headers. Verify HTTPS, CSP, no remote connections, redirects, preview noindex, and all internal links on the actual host. Keep previews private/noindex until public facts and support/install URLs are complete. Retain the previous immutable static artifact and restore that version to roll back the website.

## Extension recovery and operations

No previously published version exists in the supplied evidence; real prior-version upgrade acceptance is pending. Storage schema/migration regressions are covered by component tests. Before launch, record an upgrade exercise on the final installed packages. For an incident, users can pause/disable the extension; a release owner must build a higher-version recovery package from reviewed reverted code, preserve compatible migrations, rerun checks, and use the approved distribution channel. Do not assume a store permits downgrades or instant updates. Name the responder, support/privacy contacts, license, and signing owners in the ledger before release.
