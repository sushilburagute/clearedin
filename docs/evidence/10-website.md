# Task 10: local website implementation

Status: **implemented locally; manual browser and release acceptance pending**. Audit date: 2026-11-17.

The merge from main also retains preview robots rules and a dedicated 404 page. The site now builds nine pages including that error page; duplicate dynamic routes and the earlier demo implementation were consolidated into the current site.

Eight static Astro pages now cover home, how it works, synthetic demo, installation, provider setup, privacy, FAQ/support, and changelog. Shared UI tokens provide light/dark colors and system typography. Layouts adapt below 800px; controls have labels, focus rings, 44px targets, and reduced-motion/forced-color rules. No external fonts, images, trackers, provider calls, or credential fields are included.

The demo imports the existing exact-fixture classifier and deterministic policy. Every category begins visible. Hide, Always show precedence, reveal, pause/resume, and reset work on ten synthetic remote examples plus one local sponsored example. Experimental thresholds are explicitly limited to this synthetic demonstration. These fixed labels are not evaluation evidence.

`pnpm test:integration` builds the site and exercises its generated demo markup with linkedom. `pnpm site:check` checks all generated pages' internal links/assets, anchors, metadata, control labels, and preview notices. `pnpm boundaries:check` prevents website imports of providers/storage/extension code. The browser's network is not needed for the demo; its test forbids fetch.

Not performed: visual inspection at 360/768/1440px, real keyboard and screen-reader checks, 200% zoom, browser accessibility tree, deployed headers, hosting/domain verification. CSS and DOM checks do not substitute for these. Current install states are visibly unavailable; operator, support, domain, hosting logs, and approved store links remain pending rather than invented.

Deployment preparation: `apps/website/dist/` is the static output. `public/_headers` supplies a restrictive policy for hosts that support that format; configure equivalent HTTP headers on other hosts. Keep previews noindex. The site currently has no configured host or canonical domain and has not been published. See [release preparation](../release/README.md).
