# Task 08 — OpenAI adapter evidence

Status: local component implemented; live provider, packaged Chrome/Firefox, and quality calibration pending. Baseline: 14348e8; branch supplied by coordinator: feat/provider-adapters. No credentials were available or requested and no live request was made.

## Contract verification (2026-11-16)

- [Official model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra.md): selected exact documented snapshot `gpt-5.6-terra`, Responses and structured output support. Supports reasoning effort `none`. Current documentation lists older GPT-4.1 mini and GPT-5 mini as deprecated; they were not selected. This model choice is a fixture-tested candidate, not a quality recommendation.
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs): strict JSON schema, explicit refusal handling and local validation. Response format is `text.format` with `type: json_schema`.
- [Responses reference](https://developers.openai.com/api/reference/resources/responses): POST `https://api.openai.com/v1/responses`, Bearer API credential, bounded output, completed message and output-text parsing. No conversation, tools, streaming, or fallback; `store: false` is not a zero-retention promise.
- Model page billing: USD per million tokens, $2 input, $0.20 cached input, $12 output. Usage maps reported input/output tokens. No cost is invented from missing usage, no price guarantees, and no currency-budget enforcement is implemented here.
- [Key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety): OpenAI advises against browser/client keys. Direct extension BYOK conflicts with that guidance. Browser support is **untested**, production enablement remains gated by task 02 and an explicit architecture/security decision. No relay or browser restriction bypass was introduced.

## Implementation and exports

`packages/providers/src/openai/index.ts` exports `createOpenAIAdapter(NetworkClient)`, `OPENAI_CAPABILITIES`, and sanitized `OpenAIProviderError` implementing the canonical public error fields. `smoke.ts` exports `runOpenAISmoke({ enabled, credential, network })`: explicit opt-in, one fixed synthetic post, 10-second abort deadline, no logging and no retries. Import the smoke module directly for controlled local verification; this is not a CLI that reads or prints secrets.

The adapter consumes canonical taxonomy prompts and frozen contracts. It permits only the selected model and endpoint, uses injected fetch/abort signal, rejects redirects, omits browser credentials/referrer, bounds input/request/streamed response, validates strict model data locally, binds metadata from trusted configuration, and marks scores self-reported. Partial/empty input returns insufficient without transmission. Refusals throw `refused`; incomplete output throws `invalid_response`, never a valid empty classification. Unknown labels, duplicate entries, extra fields, contradictory abstention, invalid usage, and nonfinite/out-of-range values fail closed for remote hiding. HTTP errors are sanitized without reading private provider error bodies. The runtime owns retry/backoff and accounting.

Required optional host permission: `https://api.openai.com/*`. Registry/manifests are untouched. Coordinator adds provider subpath export and `@clearedin/taxonomy` workspace dependency.

## Validation

- `pnpm exec vitest run packages/providers/src/openai/tests`: 20 tests passed.
- `pnpm exec eslint packages/providers/src/openai packages/test-fixtures/src/providers/openai`: passed.
- `pnpm exec tsc --noEmit -p tsconfig.packages.json`: OpenAI files clean after fixture import correction; workspace blocked at time of run by unrelated `packages/ui/src/index.ts` import of missing `./demo`.
- Tests cover native request shape, trusted metadata, multi-label result, refusal, truncation, malformed/oversized response, invalid/nonfinite scores, duplicates, unknown labels, cancellation including pending body reads, HTTP failures, input bounds and prompt injection isolation.

Fixtures: `packages/test-fixtures/src/providers/openai/index.ts`. Tests: `packages/providers/src/openai/tests/adapter.test.ts`. Supporting files: adapter `index.ts`, opt-in `smoke.ts`, local `README.md`, this evidence file.

Next: task 11 must import the adapter and metadata, enforce consent, host permission and trusted credential boundaries, wire cancellation/deadlines/accounting, and preserve the production support gate. Run authorized synthetic live verification and packaged browser checks separately, then held-out semantic calibration before enabling hiding. Unit success is not live support evidence.

## Isolated integration validation

Validated on branch `feat/provider-integrations` in a separate worktree against baseline `14348e8`. `pnpm test`: 214 tests passed, one opt-in live test skipped, plus 12 boundary-script tests passed. `pnpm lint`, `pnpm typecheck`, `pnpm docs:check`, and `pnpm format:check` passed. Earlier shared-workspace UI errors are absent from this isolated provider change. Live API and packaged-browser evidence remain pending.
