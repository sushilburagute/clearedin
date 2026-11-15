# ClearedIn

A TypeScript monorepo for a user-controlled LinkedIn feed filter. This repository currently contains the **task 01 development foundation**, not a working filtering product.

## Setup

Use Node **24.22.3** (pinned in `.node-version` and `.nvmrc`) and pnpm **12.4.1**. Activate that Node version with your version manager, then install the pinned pnpm version if needed:

```sh
npm install --global pnpm@12.4.1
pnpm install --frozen-lockfile
```

The install generates WXT types. No API keys are needed. Exact dependencies and the lockfile are committed. TypeScript stays on 5.9.3 for compatibility with the selected lint/typechecking tooling.

If you cannot switch the shell's Node version, an alternative that leaves global tools unchanged is:

```sh
npx --yes --package=node@24.22.3 --package=pnpm@12.4.1 pnpm install --frozen-lockfile
```

Use that same prefix for the commands below when your default Node is outside the supported range.

## Commands

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm docs:check
pnpm build
pnpm package:chrome
pnpm package:firefox
pnpm artifacts:check
```

`pnpm test:integration` deliberately exits **2** with `NOT IMPLEMENTED`. Packaged-browser behavior belongs to tasks 02/11 and has not been demonstrated by compiling an extension. CI does not count that placeholder as a passing test suite.

`pnpm format` formats source/configuration; existing planning documents retain their authored layout. `pnpm docs:check` checks local documentation links and code fences, not external website availability.

For local development:

```sh
pnpm --filter @clearedin/website dev
pnpm --filter @clearedin/extension dev
pnpm --filter @clearedin/extension dev:firefox
```

## Workspace

- `apps/extension`: WXT/React popup, options, background, and feed-scoped content entrypoints. The background/content scripts are inert; no posts are read and no provider requests run.
- `apps/website`: Astro static development preview.
- `packages/contracts`: runtime schemas, derived types, and shared interfaces.
- `packages/taxonomy`: twelve category definitions and examples.
- `packages/test-fixtures`: explicit synthetic classifier and fixtures, never production inference.
- `packages/providers`: shared adapter type and reserved provider/registry boundaries.
- `packages/decision-engine`, `linkedin-adapter`, `storage`, `ui`: package shells for later assignments.

Packages expose TypeScript source for workspace consumers to bundle; there is no published package distribution or separate declaration build yet. Keep code imports inside the documented dependency graph; `pnpm lint` checks manifests, imports, aliases, and re-exports.

## Outputs and limitations

Website output is `apps/website/dist/`. Extension builds are under `apps/extension/.output/chrome-mv3/` and `firefox-mv3/`; browser ZIPs are alongside them. Generated artifacts are ignored by Git. `artifacts:check` compares ZIP contents with inspected builds and performs basic manifest/code checks, not a comprehensive security audit.

Firefox uses `development@clearedin.invalid`, minimum version 140, and a no-data declaration appropriate to this inert scaffold. These are development settings, not a validated production support matrix. Provider integration must revisit permissions and data declarations. The generated Firefox sources ZIP contains extension-local sources only; task 13 must prepare a complete reproducible monorepo reviewer bundle before submission.

Start with the [documentation index](docs/README.md), [assignment guide](docs/build-assignments.md), and [foundation handoff](docs/evidence/01-foundation.md).
