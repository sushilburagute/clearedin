# Anthropic adapter

Task 09 implements `createAnthropicAdapter(network)` using the frozen classifier contract. Import the factory and `ANTHROPIC_CAPABILITIES` from `@clearedin/providers/anthropic`. Errors are sanitized `AnthropicAdapterError` instances with `code` and `retryable`; no automatic retries occur.

The model is pinned to `claude-haiku-4-5-20251001`, Messages API version `2026-10-21`. The injected network client must honor abort signals and redirect rejection. Task 11 owns consent, host permission, deadlines, budgets and registry wiring. Browser production enablement remains gated.

For a deliberately authorized live check, import `runAnthropicSmoke` from `./smoke` in a trusted harness and pass `{optIn: true, credential, network: {fetch}, signal}`. It sends exactly one synthetic request with a 10-second abort deadline and returns only aggregate metadata. Do not put credentials in source or CLI arguments. No live test was run during implementation.

See [evidence](../../../../docs/evidence/09-anthropic.md) for sources, limitations and validation.
