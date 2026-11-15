# Data contracts and persistence

These are implementation specifications, not existing exported TypeScript types. Implement matching runtime schemas in `packages/contracts` and derive static types from them. Unknown fields, enum values, duplicate category entries, oversized strings, and nonfinite scores are rejected.

## Classification data

```ts
type ProviderId = 'typesafe' | 'openai' | 'anthropic';
type CategoryMode = 'show' | 'hide' | 'always_show';
// CategoryId is the exact ID union from classification-and-rules.md.

interface ClassificationInput {
  requestId: string;
  text: string;                 // minimized, <= 8,000 characters
  extraction: 'complete' | 'partial';
  taxonomyVersion: string;
  promptVersion: string;
}

interface ClassificationResult {
  schemaVersion: 1;
  requestId: string;
  provider: ProviderId;
  model: string;
  adapterVersion: string;
  taxonomyVersion: string;
  promptVersion: string;
  sufficiency: 'sufficient' | 'insufficient';
  categories: Array<{
    id: CategoryId;
    score: number;              // finite, [0,1]; semantics named below
    scoreKind: 'typed_membership' | 'self_reported';
  }>;
  abstention: null | 'insufficient_text' | 'unsupported_language'
    | 'ambiguous' | 'refused';
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    questions?: number;
    estimatedCost?: number;
    currency?: string;
  };
}
```

The adapter constructs provider/model/version metadata from trusted configuration, not provider-generated text. `sponsored` is excluded from remote category results and merged as a separate locally verified signal. Missing remote categories mean no positive evidence, not a confident negative. Scores are not summed or required to add to one.

Any non-null abstention prevents remote-category hiding. Normalize abstentions to `sufficiency: 'insufficient'` with an empty remote category array; reject contradictory provider output before it reaches policy. Current partial extraction also prevents remote hiding, including when a cache entry is available.

The background computes a content digest for deduplication; DOM identity, account URLs, author names, and DOM generation are local bookkeeping and never part of provider input. A hash is still potentially identifying and must not be treated as anonymous telemetry.

## Extension messages

Version every message with `protocolVersion: 1`, a type discriminator, and a request ID. Content scripts may send `CLASSIFY_POST`, `CANCEL_SUBSCRIPTION`, and `GET_PUBLIC_STATUS`; they may receive only classification data, relevant rule settings, and sanitized status. Options pages may additionally use `SET_PREFERENCES`, `SET_PROVIDER`, `SET_CREDENTIAL`, `DISCONNECT_PROVIDER`, `SET_CONSENT`, `CLEAR_DATA`, and `EXPORT_DIAGNOSTICS`.

`CLASSIFY_POST` contains the bounded text, extraction status, and local post identity/generation. The broker validates sender extension ID, sender URL/origin, tab, frame, supported feed route, payload size, rate, and allowed message type. Never accept a caller-supplied destination URL, header object, prompt, model override, or arbitrary fetch operation. Privileged commands must originate from an allowlisted extension-owned page, not merely share the extension ID.

No `window.postMessage` bridge is required. Do not expose externally connectable messaging. Document browser-specific sender-field differences in the wrapper and test both browsers.

Both the exact allowlisted popup page and options page may send `SET_ENABLED` for Pause/Resume. Disabling increments the enablement generation, cancels queued/in-flight work, and broadcasts `RESTORE_ALL` to content scripts. Resuming requires valid consent and configuration. The popup may read public status but cannot set/read credentials or invoke the other options-only mutations.

## Settings schema

Persist `schemaVersion`, `enabled` (default false), `categoryModes`, selected `provider`/`model`, daily request limit, optional estimated cost cap, language configuration, and user-confirmed consent record. Consent records contain version, provider/recipient identity, disclosed data classes, timestamp, and status. Switching provider invalidates consent until a new disclosure is accepted.

Store the provider credential separately in trusted session storage or the vetted alternative from phase 0. Never serialize it into settings, diagnostics, exports, URLs, website code, or content-script replies. Do not use browser sync for keys or browsing-derived state.

## Storage inventory

| Data | Location | Retention and deletion |
| --- | --- | --- |
| Preferences and consent | Extension local storage | Until reset/uninstall; schema migrations preserve intent. |
| API credential | Trusted extension session facility | Until disconnect or browser session end; verify actual browser lifecycle. |
| Raw post text | Content/background memory | Release after response, cancellation, or deadline; never persist. |
| Classification cache | Background memory | 30-minute TTL, max 500 LRU entries; clear on reset/provider change. |
| Post reveal overrides | Content-script memory | Current document/post lifetime; removed on route exit/reset. |
| Request/cost reservations | Extension local storage | Current accounting day plus prior day for reconciliation; no post text/IDs. |
| Local diagnostic ring | Memory | Max 200 sanitized events; clear at session end or reset. |

Background owns writes to settings and counters to prevent tab races. Serialize read-modify-write operations and persist reservations before dispatch. On restart, conservatively keep unresolved reservations; do not refund uncertain billed requests. Counter entries contain request IDs without post identities and expire with accounting retention.

## Schema migration and deletion

Use sequential, tested migrations with validation before and after each step. Never silently convert `show` to `always_show`. Unknown future versions disable filtering and explain the need to update; do not overwrite data with defaults. Back up only non-secret configuration during a migration, remove the backup after success, and include backups in Clear all data.

Clear all data increments an in-memory generation, aborts requests, broadcasts restoration to open content scripts, clears storage and caches, and returns to onboarding disabled. Reject all old callbacks before they can write or re-hide posts. Already transmitted provider data is governed by provider retention and cannot be deleted by clearing extension storage.
