# Task 09 — Anthropic adapter evidence

Status: local component implemented; live and packaged-browser evidence pending. Verification date: 2026-11-16. Prerequisites: accepted foundation and taxonomy/policy baseline `14348e8`; contracts remain unchanged.

## Verified official contract

- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs): native `output_config.format` JSON schema; local validation remains necessary. Numerical bounds are checked locally, with descriptions in the provider schema.
- [Messages API](https://platform.claude.com/docs/en/api/messages): fixed `POST https://api.anthropic.com/v1/messages`, workspace-scoped `x-api-key`, native message content and usage. Model selection is `claude-haiku-4-5-20251001` (fixture tested; account availability untested).
- [API versioning](https://platform.claude.com/docs/en/api/versioning): pinned `anthropic-version: 2026-10-21`. No removed sampling parameters are sent.
- [SDK browser guidance](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript): browser execution is disabled by default due to credential exposure; opting in is explicitly dangerous. This fetch component adds no browser-bypass header or SDK override. Packaged Chrome/Firefox support and credential custody remain untested and must be resolved before enablement.
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing): Haiku 4.5 standard USD per million input/output tokens: 1/5; five-minute cache creation 1.25, one-hour creation 2, cache reads 0.10. Metadata is a dated estimate source, not a spending guarantee. No caching requested and no monetary cost fabricated from incomplete usage.

## Implementation and safety

Exports `createAnthropicAdapter`, `ANTHROPIC_CAPABILITIES`, `AnthropicAdapterError`; opt-in helper `runAnthropicSmoke` in `smoke.ts`. Permission requirement `https://api.anthropic.com/*`. Shared registry and manifests are untouched.

Canonical taxonomy prompts separate untrusted post data from system instructions. Single bounded request, no history/tools/retries/fallback. Maximum input is 8,000 characters; serialized request limit 64 KiB, output 1,024 tokens, response stream limit 32 KiB. Redirects are rejected and credentials omitted from cookies. Trusted metadata is locally constructed. Invalid/duplicate labels, contradictory abstention, bad usage, malformed output, refusal and truncation never yield usable classifications. Partial extraction short-circuits to insufficient. Cached token buckets are included in normalized input usage; no estimated cost is returned.

HTTP 400 maps conservatively to `unsupported_schema`, 404 to `unsupported_model`, 401/403 to credential/permission errors, 429 to rate limiting, server/network failures to unavailable. Raw errors/bodies are never public. The integration owner may refine unsupported-schema versus other invalid-parameter errors after live evidence without exposing provider messages.

## Actual validation

- `pnpm exec vitest run packages/providers/src/anthropic/tests`: 20 tests passed.
- Scoped ESLint: passed.
- Scoped Prettier: formatted.
- `pnpm exec tsc --noEmit -p tsconfig.packages.json`: no Anthropic errors; blocked by existing concurrent UI import of missing `./demo` at execution time.
- Live API: not run; no credentials supplied.
- Packaged Chrome/Firefox: not run; no provider-access proof.

Files: adapter, smoke helper, README and tests under `packages/providers/src/anthropic/`; synthetic fixture under `packages/test-fixtures/src/providers/anthropic/`; this evidence. Parent owns adding taxonomy dependency and package subpath export.

Task 11 must wire the factory to trusted background networking, enforce consent/reservations and ten-second logical deadlines, interpret sanitized errors, and independently prove packaged access. Quality evaluation/calibration and credential security approval remain prerequisites to production hiding. A local mock test does not prove those gates.

## Isolated integration validation

Validated on branch `feat/provider-integrations` in a separate worktree against baseline `14348e8`. `pnpm test`: 214 tests passed, one opt-in live test skipped, plus 12 boundary-script tests passed. `pnpm lint`, `pnpm typecheck`, `pnpm docs:check`, and `pnpm format:check` passed. Earlier shared-workspace UI errors are absent from this isolated provider change. Live API and packaged-browser evidence remain pending.
