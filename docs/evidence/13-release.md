# Task 13: release preparation

Status: **partial**, 2026-11-17. No release, signing, submission, publication, or deployment performed.

Added a versioned [gate ledger](../release/gates.json), [reviewer/build/recovery instructions](../release/README.md), and developer commands:

- `pnpm release:check` validates the ledger and evidence paths, then exits 2 while any gate is pending/failed. A passed gate requires an explicitly named acceptance owner and evidence.
- `pnpm release:prepare` writes a complete monorepo source ZIP, both development browser ZIPs, a website ZIP, and SHA-256 inventory into ignored `.release/`. It uses the current workspace and records the base commit plus dirty status, rather than mislabelling uncommitted edits as a tagged release.
- Source archives include workspace packages, lockfile, configs, tests, experiments, and docs. Ignored outputs, Git metadata, credentials files, and the pre-existing user-owned `artifacts/` directory are excluded. The WXT Firefox sources ZIP remains extension-local and must not substitute for this full monorepo source bundle.
- CI runs local integration and website checks and uploads development review materials. It has no provider secrets, signing, store submission, or deployment step.

Pending release gates remain independently visible. The machine-readable ledger intentionally has no invented owner names or inferred approvals. Build hashes identify inspected bytes, not product readiness or permission to distribute. Rebuild all assets after source changes and prepare the final bundle only from an accepted clean tag.

Local preparation passed: both browser archives matched inspected builds byte for byte. The full source archive was independently read with the platform ZIP reader, verifying all 208 entries against the inventory and all four artifact hashes. The gate command reported 11 pending gates and underlying exit 2. No final tagged rebuild or hosted CI run is claimed.
