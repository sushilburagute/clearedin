# ClearedIn

ClearedIn is a development preview for a user-controlled LinkedIn home-feed filter. The Chrome and Firefox extensions save category rules and usage limits locally. The website demonstrates all 12 categories on 14 synthetic posts. **Live filtering and provider connections are disabled.**

## Run locally

Use Node **24.22.3** and pnpm **12.4.1**. From the repository root, install dependencies and start the app you want to work on.

```sh
pnpm install --frozen-lockfile
pnpm --filter @clearedin/website dev
```

For the extension, run `pnpm --filter @clearedin/extension dev` for Chrome or `pnpm --filter @clearedin/extension dev:firefox` for Firefox. Development and fixture tests require no API key. If your shell has a different Node version, prefix pnpm commands with `npx --yes --package=node@24.22.3 --package=pnpm@12.4.1`.

## Deploy the website to Vercel

Import the repository with **Root Directory** set to `apps/website` and leave **Include source files outside of the Root Directory in the Build Step** enabled so Astro can read the shared workspace packages and lockfile. The [Vercel configuration](apps/website/vercel.json) builds the static site with the pinned pnpm version. It skips install lifecycle scripts because the root `prepare` script generates browser extension files. The static demo needs no environment variables or API keys.

The public demo runs at [clearedin.sush.dev](https://clearedin.sush.dev/). Its pages allow indexing when Vercel builds with `VERCEL_ENV=production`. Other builds and the 404 page carry a `noindex` directive. All deployments apply the security headers and give Astro’s fingerprinted assets a one-year browser cache. When changing the workspace pnpm version, update both commands in `apps/website/vercel.json` as well.

## Commands

| Command                                            | Purpose                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck` | Check code, package boundaries, formatting, and types                            |
| `pnpm test`                                        | Run package, evaluation, and script tests                                        |
| `pnpm test:integration`, then `pnpm site:check`    | Build the website, exercise the synthetic runtime, and check the generated pages |
| `pnpm docs:check`                                  | Check documentation links and code fences                                        |
| `pnpm build`                                       | Build the static site and both browser extensions                                |

## Maintainer guides

- [Architecture and feed rules](docs/software-architecture.md) explains where to change extraction, classification, settings, or visibility.
- [UI and accessibility](docs/design-guidelines.md) covers the website, extension surfaces, and hidden-post controls.
- [Security and privacy](docs/security-and-privacy.md) describes consent, credential custody, and what may leave the browser.
- [Testing and evaluation](docs/testing-and-evaluation.md) covers packaged-browser checks, evaluation inputs, and acceptance criteria. The [verification record](docs/completion-audit.md) records what has been tested.
- [Release and recovery](docs/release/README.md) covers packaging, reviewer checks, and rollback. The [release ledger](docs/release/gates.json) tracks outstanding decisions.
