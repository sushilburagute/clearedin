# Task 10: website handoff

Status: local implementation complete; acceptance partial pending browser checks and shared UI token handoff.

Prerequisites: foundation, taxonomy/policy and fake-classifier exports are present. `packages/ui/src/index.ts` has no token exports at this baseline. The website temporarily implements the exact documented design palette locally; replace it with task 06 exports when accepted. No production provider code is imported.

## Delivered

Nine static routes: home, how it works, synthetic demo, installation, provider setup, privacy, FAQ/support, changelog and 404. Shared semantic layout includes skip navigation, title/description, noindex metadata and current-page navigation. Responsive layouts cover 360/768/1440 design widths, native labelled controls, visible focus, dark theme and reduced-motion rules.

Demo calls `createSyntheticClassifier` on fixed fixtures, then `createVisibilityEvaluator({ allowExperimental: true })` using synthetic-only thresholds. Category changes rerun policy without inference. Always-show overlap, insufficient text, abstention and session reveal use existing contracts. Reveal moves focus to revealed text; rules never persist. Rendering uses textContent. No keys, provider execution, network APIs or credential storage are present. The fake result provider field is an internal schema detail, never presented as real provider evidence.

Changed paths: `apps/website/src/`, `apps/website/public/`, `apps/website/tests/check-static.mjs`; coordinator owns package dependency and lockfile changes. No new shared interfaces or migrations.

## Actual checks

- `pnpm.cmd --filter @clearedin/website typecheck`: passed, 0 errors/warnings/hints.
- `pnpm.cmd --filter @clearedin/website build`: passed, 9 pages.
- `node apps/website/tests/check-static.mjs`: passed; built internal links, metadata, no key inputs and offline bundle checks.
- Initial build found Windows text encoding; normalized source to UTF-8 and rebuilt successfully.
- Browser keyboard, screen-reader, 200% zoom, 360/768/1440 screenshots, dark/light measured contrast and reduced-motion execution: **pending**, not inferred from CSS. Synthetic screenshot assets: pending those browser checks.

## Static deployment preparation (not deployed)

Build from the accepted release commit with the lockfile and pinned toolchain. Serve `apps/website/dist` at the origin root with directory index routes and 404.html. `_headers` provides a static-host header configuration; hosts that do not understand it must apply equivalent HTTP headers. In particular connect-src none prevents provider traffic. Verify headers, HTTPS and all routes on the selected host before release. No server runtime is required. Retain the previous immutable dist artifact and restore it for website rollback.

Preview stays noindex via metadata, robots.txt and headers. Do not remove these until release gates pass. Set the actual site origin/canonical metadata in Astro config and layout only after the domain is approved. Hosting vendor/logging, legal operator, support contact, domain, provider/browser support and distribution decisions remain launch blockers.

Installation states are explicit text in `src/pages/[slug].astro`. Replace each browser's unavailable text with its independently verified approved listing URL only after release-owner approval; never invent listing IDs. Reconcile privacy and supported configurations against task 11/12 evidence. No publication or deployment occurred.
