# Architecture and feed rules

The WXT/React extension and Astro website share a TypeScript workspace. The shipping extension runs a settings broker and an inert content script. The feed adapter, coordinator, and provider adapters are implemented and exercised with synthetic inputs. Connecting them to a real feed requires the decisions in the [release ledger](release/gates.json).

| Change | Start here |
| --- | --- |
| Popup, options, or browser entrypoints | [Extension app](../apps/extension/entrypoints) and [shared controls and controllers](../packages/ui/src) |
| Message formats, settings, or migrations | [Contract schemas](../packages/contracts/src) and [storage](../packages/storage/src) |
| Feed discovery, extraction, or placeholders | [LinkedIn adapter](../packages/linkedin-adapter/src) and [content session](../apps/extension/src/content/session.ts) |
| Labels, prompts, or precedence | [Taxonomy](../packages/taxonomy/src) and [decision engine](../packages/decision-engine/src) |
| Provider requests or scheduling | [Provider registry](../packages/providers/src/registry.ts) and [background coordinator](../apps/extension/src/background/coordinator.ts) |
| Website demo | [Build-time policy](../apps/website/src/demo-policy.ts) and [client controls](../apps/website/src/demo.ts) |

## How a post gets a visibility decision

1. The adapter reads visible post text on the desktop home feed. It associates each node with an identity, content digest, and generation so a late reply cannot hide a recycled post. An explicit visible Sponsored or Promoted disclosure supplies the local sponsored signal.
2. The coordinator checks enablement, consent, provider, and generation. Complete text can use a cached classification or share a pending request. Cache keys include the content digest, extraction and extractor version, taxonomy, prompt, provider, model, and adapter version.
3. A provider labels content. Local policy decides whether to collapse it. All categories start at **Show normally**. A qualifying **Always show** match wins over **Hide**. For example, a technical product launch stays visible when launches are hidden and technical content is protected.
4. Leave the post visible on pause, missing consent, an unsupported route, stale identity, unhealthy extraction, or a user reveal. Partial text, abstention, and invalid results supply no remote evidence. A reliable local sponsored disclosure can still qualify under the same precedence rules. Keep the post visible while a possible protection match is pending.
5. Changing preferences reuses available classifications. Reveal restores the original post for the page session. Pause or teardown cancels obsolete subscriptions, restores host markup, and removes placeholders and announcements.

## Storage and limits

Settings start disabled, with English selected, a daily limit of 200 requests, and no cost cap. Settings, consent, and the usage ledger are local. The background serializes writes and advances a generation when an operation invalidates outstanding work. An explicit reset can recover incompatible data and leaves a disabled generation marker.

Reserve a request durably before dispatch. Failed or interrupted attempts still count. Verify the response’s request ID and provider configuration before settling cost. Unknown prices block requests when a monetary cap is active. The ledger uses its original timezone and a persisted clock watermark so a restart or clock rollback cannot reset a day twice.

The scheduler allows two active jobs and 50 queued jobs with a 10-second deadline from admission. The memory-only classification cache holds up to 500 entries for 30 minutes. Changing model, taxonomy, or prompt requires compatible cache keys and a fresh [evaluation](testing-and-evaluation.md).
