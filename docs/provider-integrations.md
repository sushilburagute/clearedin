# Provider integrations

## Supported integration targets

The intended v1 targets are TypeSafe Jev, OpenAI, and Anthropic. Support means a particular adapter/model/browser combination has passed connection, schema, privacy, quality, and cost tests. It does not mean every model or compatible-looking endpoint is supported. Exact model IDs and API versions are selected and pinned during the feasibility spike, with verification dates in the adapter registry.

“ChatGPT” in the product brief maps to the OpenAI API; the extension does not automate a consumer chat website or read its session cookies. Onboarding must explain the selected provider's API credential and billing requirements using its current documentation.

## Adapter contract

```ts
interface ClassifierAdapter {
  id: 'typesafe' | 'openai' | 'anthropic';
  classify(input: ClassificationInput, context: {
    model: string;
    credential: string; // background context only; never serialized in a reply
    signal: AbortSignal;
  }): Promise<ClassificationResult>;
}
```

The input/result names are defined in [data contracts](data-contracts.md). The coordinator owns limits, cache, consent, and retries; adapters own the provider wire format, headers, endpoint, refusal interpretation, response validation, and usage normalization. An adapter cannot choose a different provider or execute returned code.

## TypeSafe Jev

Jev evaluates typed questions against shared state. TypeSafe documents Choice, Score, and Noul primitives with distinct return semantics; it supports independent questions in a request. Use the official [introduction](https://docs.typesafe.ai/introduction) and [model framing](https://typesafe.ai/blog/dont-call-it-a-decision-model), rather than treating Jev as a chat model that must generate JSON.

Proposed mapping: supply minimized post text as state; use one Noul category-membership question per remote category, plus a separate sufficiency check. Convert each 0–1 membership result into the normalized score field with `scoreKind: 'typed_membership'`. Do not fabricate a separate confidence field where that primitive does not return one. Validate multi-label behavior, uncertainty handling, payload limits, usage reporting, and actual API field names in the spike. The eleven remote category questions exclude `sponsored`, which uses a DOM marker.

Choice can be evaluated for a primary topic but must not replace independent categories: a hiring post can also request referrals. Never send “hide or show” as the only question. The UI explanation is derived from categories and rules, not a fabricated Jev-generated rationale.

Prefer direct TypeSafe access if proven feasible. A gateway route is a different integration with a different credential issuer and data recipient; it requires an explicit adapter, permission, disclosure, and consent. Do not silently treat a Vercel or other gateway key as a TypeSafe key.

## OpenAI and Anthropic

Use supported structured-output facilities for the chosen model/API, with a bounded array of category scores, sufficiency, and abstention reason. Provider-specific schema syntax stays inside the adapter. Parse and validate again locally even if constrained output is enabled. Handle refusals and incomplete/truncated responses separately from a valid empty-category result.

For LLM-returned scores, set `scoreKind: 'self_reported'`. Evaluate empirical reliability before using scores as hiding thresholds. No tools, browsing, arbitrary URL fetching, conversation history, or agent loops are needed. Use a short classification instruction and delimited untrusted input. Prefer a small tested model; choose based on ClearedIn's evaluation rather than generic leaderboard claims.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Recheck supported schema subsets and model capabilities at implementation time.

## Access and credential feasibility

Test packaged-extension requests in both browsers. Check provider policy, authentication headers, browser-client restrictions, host permissions, and SDK behavior. Use minimal fetch adapters where an SDK adds unnecessary bundle weight, but never bypass a provider restriction merely to make the demo work.

OpenAI recommends keeping API keys out of browser/client applications; direct extension BYOK carries a documented mismatch with that guidance. See [key safety](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety). The initial architecture is provisional: validate provider-supported client access and the security decision before advertising it. Alternatives include a user-controlled companion service with credentials outside the browser or a separately designed authenticated backend. A backend changes data custody and is not a hidden implementation detail.

## Requests, errors, and cancellation

Initial limits: 2 concurrent requests globally, queue length 50, 10 seconds per logical classification including any retry, maximum 8,000 input characters and 32 KiB response body. Mark longer input partial and show it. Adapters enforce their token/question limits within these outer bounds.

At most one automatic retry for a transient 429/5xx or network failure, with jitter and `Retry-After` respected only if it fits the deadline. Never retry authentication, unsupported model, refusal, or invalid schema errors automatically. A retry consumes another request reservation. Timed-out requests may already have been billed; cancellation does not reverse provider processing.

After three consecutive transient provider failures, open a local circuit for 60 seconds; continue showing posts. A single subsequent synthetic/user-triggered probe or eligible classification closes it on success. Authentication errors require user action. Do not fan out to other providers as fallback.

Every response is tagged to the originating provider/model/configuration and enablement generation. Changing provider, withdrawing consent, or clearing data aborts requests and prevents late results from changing the feed.

## Usage and budgets

Proposed default: 200 outbound classification attempts per local calendar day, adjustable by the user. Clearly show reset timezone; account for multiple tabs in one coordinator. Reserve an attempt durably before issuing a request. Limit resets must not occur twice when the clock moves backward. Synthetic connection tests count and are labeled.

Also offer an optional estimated currency cap. Store pricing metadata with a verification date and actual provider billing units: some providers may charge per token, question, or other unit. Reserve a conservative upper-bound estimate before dispatch where pricing is known; never label estimates as an enforced provider-side spending cap. If pricing is unknown, show “Cost unavailable,” retain request limits, and do not allow a currency cap to masquerade as enforceable.

Reconcile reported usage after a response; retain conservative reservations for unknown outcomes. Encourage provider-side spend controls where available. Do not embed price claims or a promise of fixed monthly cost in the website.
