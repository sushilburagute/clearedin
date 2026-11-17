# ClearedIn

A TypeScript monorepo for a user-controlled LinkedIn feed filter. Shared components, three provider adapters, persistent local extension settings, an offline integration flow, and an eight-page website with a synthetic demo are implemented. **Live feed filtering and provider connections remain disabled.** See the [completion audit](docs/completion-audit.md) for verified work and remaining gaps.

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

`pnpm test:integration` builds the website and runs local integration tests against injected browser ports, synthetic DOM, the real policy, and fixed classifier fixtures. It is **not packaged-browser evidence**. `pnpm site:check` checks the generated website. `pnpm release:check` deliberately exits **2** while the explicit release ledger has unresolved gates. `pnpm evaluate input.json report.json` evaluates independently labelled outcomes; no corpus or live accuracy is fabricated.

`pnpm format` formats source/configuration; existing planning documents retain their authored layout. `pnpm docs:check` checks local documentation links and code fences, not external website availability.

For local development:

```sh
pnpm --filter @clearedin/website dev
pnpm --filter @clearedin/extension dev
pnpm --filter @clearedin/extension dev:firefox
```

## Workspace

- `apps/extension`: WXT/React popup/options connected to a strict background settings broker. Category preferences persist locally. The production content script remains inert; no posts are read or provider requests run. Injected coordinator/scheduler/content-session modules have offline coverage and await production enablement gates. A separate synthetic UI demo never accepts credentials.
- `apps/website`: Eight Astro static pages and an interactive synthetic policy demo; no credentials, provider traffic, analytics, or backend.
- `packages/contracts`: runtime schemas, derived types, and shared interfaces.
- `packages/taxonomy`: twelve category definitions, examples, and versioned classification assets.
- `packages/test-fixtures`: explicit synthetic classifier, policy cases, and storage/browser fixtures, never production inference.
- `packages/providers`: Separate Jev, OpenAI, and Anthropic adapters and a registry that keeps all unverified production configurations unavailable.
- `packages/decision-engine`: pure visibility policy and experimental/evaluated threshold configuration.
- `packages/storage`: validated settings/migrations, gated session credentials, durable attempt accounting, and bounded memory cache/diagnostics.
- `packages/linkedin-adapter`: feed-only extraction, bounded observers, local identity, and reversible collapse/reveal, tested against synthetic DOM fixtures. Live LinkedIn selector compatibility is unverified.
- `packages/ui`: shared design tokens, accessible controls, popup/options components, and typed controllers with an explicit demo transport. The extension supplies the real settings transport.

Packages expose TypeScript source for workspace consumers to bundle; there is no published package distribution or separate declaration build yet. Keep code imports inside the documented dependency graph; `pnpm lint` checks manifests, imports, aliases, and re-exports.

## Outputs and limitations

Website output is `apps/website/dist/`. Extension builds are under `apps/extension/.output/chrome-mv3/` and `firefox-mv3/`; browser ZIPs are alongside them. Generated artifacts are ignored by Git. `artifacts:check` compares ZIP contents with inspected builds and performs basic manifest/code checks, not a comprehensive security audit.

Firefox uses `development@clearedin.invalid`, minimum version 140, and a no-data declaration reflecting the disabled remote path. These are development settings, not a validated production support matrix. Only `storage` permission is required. Provider enablement must revisit permissions and declarations. The WXT Firefox sources ZIP is extension-local; `pnpm release:prepare` creates a full monorepo source bundle, browser/website ZIPs, and SHA-256 inventory in ignored `.release/`. The inventory distinguishes a dirty workspace from an accepted clean release tag.

Start with the [documentation index](docs/README.md), [assignment guide](docs/build-assignments.md), and [foundation handoff](docs/evidence/01-foundation.md).

Component handoffs: [taxonomy and policy](docs/evidence/03-taxonomy-and-policy.md), [storage and credentials](docs/evidence/04-storage-and-credentials.md). Production credential enablement still requires the pending evidence in the [browser-feasibility handoff](docs/evidence/02-browser-feasibility.md).

UI/DOM handoffs: [feed adapter](docs/evidence/05-feed-dom-adapter.md), [extension UI](docs/evidence/06-extension-ui.md). Current integration: [website](docs/evidence/10-website.md), [runtime](docs/evidence/11-runtime.md), [evaluation](docs/evidence/12-validation.md), and [release preparation](docs/evidence/13-release.md). No live-provider/browser acceptance, public deployment, or store approval is claimed.
