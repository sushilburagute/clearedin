# Task 13 release preparation evidence

Status: partial, development candidate only; public launch NOT READY. Validated 2026-11-16 on Windows with Node v24.6.0 (below required >=24.11.0) and pnpm 12.4.1. Supported-toolchain CI and second-environment reproducibility remain pending.

## Delivered

Release procedure, reviewer copy, permission rationale, first-release migration status, higher-version recovery and deployment rollback instructions are in ../release/README.md. Gate owners, unresolved facts and release ledger fields are in ../release/gates.md. Owners remain unassigned rather than invented. No publishing, submission, signing or deployment occurred.

`scripts/release-inventory.mjs` records source commit, dirty status, sizes and SHA-256 hashes of both browser ZIPs and every website file in ignored `artifacts/release-inventory.json`. Run again at accepted clean source. WXT's sources ZIP includes only the extension workspace and is NOT sufficient reviewer source: retain a full repository source archive with shared packages, lockfile and root build scripts (`git archive --format=zip --output=artifacts/repository-source.zip HEAD`).

## Actual local validation

- lint and workspace boundaries: passed.
- tests: 227 passed, 1 skipped; 12 boundary checker tests passed.
- format:check and docs:check: passed.
- typecheck: passed, Astro 0 errors/warnings/hints.
- website build and static checks: passed, 9 pages with working internal links and offline demo bundle.
- Chrome and Firefox MV3 builds and ZIP packaging: passed.
- artifacts:check: passed manifest checks, basic secret/remote-script patterns and ZIP/build byte parity for both browsers.
- release inventory: generated for 15 files; initially labeled dirty development source, not an accepted tag.

WXT browser-module resolution required an explicit app-owned alias when bundling dependency-injected workspace storage. No remote code is externalized. Storage is the only required permission; provider host permissions and production credential support remain unavailable.

## Remaining acceptance

Tasks 05/06 adapter and UI prerequisites are absent. Runtime helpers are not a working end-to-end feed product. Browser execution, screen-reader/zoom/keyboard checks, synthetic screenshots, live provider feasibility, independent annotations and quality/performance measurements remain pending. Basic artifact scanning is not comprehensive security or license review. Operator/domain/support facts, accountable people, platform decision, exact submission-date policy checks and release approval must be supplied before launch. See task 10-12 evidence and the gate ledger. No gate is passed by inference from build success.
