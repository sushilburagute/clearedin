# Task 04 storage and credentials handoff

Status: **injected storage implementation complete; production credential enablement remains gated**. Date: 2026-11-16. Branch: `feat/03-04-policy-and-storage`, based on `21775cd` on `main`. The accepted task 01 contracts are unchanged. Task 02's [partial feasibility handoff](02-browser-feasibility.md) permits fixture development, but does **not** accept production enablement: persistent-install browser restart and interactive host-permission evidence are still missing. No production runtime, manifest, or credential feature is activated here.

## Files and exports

The public entrypoint is `@clearedin/storage`, implemented in `packages/storage/src/index.ts`:

- `createStorage({ browser: BrowserPorts, clock: Pick<Clock, 'now'>, timeZone: string })` returns the frozen-contract ports `settings`, `credentials`, `usage`, `cache`, and `diagnostics`, plus `public.readSettings()`, `public.readStatus()`, `clearAll(expectedGeneration)`, and `disconnect(provider, expectedGeneration)`. Construct and retain one facade in the trusted background, using one stable local-storage port. UI/content receive validated replies, never this object or the credential port.
- `StorageError` carries only a shared `ErrorCode`. Browser exceptions and schema payloads are replaced with static codes. Public settings use the strict non-secret settings schema; status exposes credential availability as a boolean. Status reads are serialized as one operation, so resets cannot mix settings from one generation with accounting/credentials from another. Unsupported settings produce disabled, unavailable status with `unsupported_schema` without overwriting the stored data.
- `prepareTrustedSessionStorage` and `SessionArea` adapt injected promise-based session APIs. Chrome must successfully await `setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })`. Firefox requires explicit accepted native-isolation evidence for that target; it does not emulate Chrome's missing setter. Missing/failed isolation returns null. Credential access additionally requires both capability flags and a non-null trusted session port. There is no persistent fallback.
- `migrateSettings` and the owned key constants `SETTINGS_KEY`, `MIGRATION_BACKUP_KEY`, `USAGE_KEY` document persistence. `core.ts` owns serialization, validation, generations, migration recovery, and error sanitization; `settings.ts`, `credentials.ts`, and `usage.ts` implement their respective ports.
- `estimateKnownCost`, `KnownPricing`, and `BillingUnits` in `pricing.ts` accept caller-supplied, versioned pricing metadata with a verification date and explicit token/question rates. Missing pricing or required upper-bound units returns null. No actual provider prices, supported models, exchange rates, or network calls are embedded.
- `memory.ts` exports `createClassificationCache`, `ClassificationCacheOptions`, `createDiagnosticsBuffer`, `CACHE_TTL_MS`, `CACHE_MAX_ENTRIES`, and `DIAGNOSTICS_MAX_EVENTS` independently of durable storage.
- `@clearedin/test-fixtures/storage` exports `createStorageBrowserFixture`, `StorageBrowserFixture`, and `StorageBrowserFixtureOptions`: copied in-memory browser ports, deterministic clock/timers, rollback/advance, permission choices, background recreation, browser-session end, and snapshots. This is synthetic lifecycle evidence, not a browser capability probe.

Tests are colocated in `packages/storage/tests/{settings,credentials,usage,pricing,memory}.test.ts`, with internal fake ports in `helpers.ts`. The reusable fixture has its own `packages/test-fixtures/tests/storage.test.ts`. The fixture package manifest adds the `./storage` export. No external dependencies or shared contract changes were needed.

## Settings and migrations

Settings are stored in an envelope `{ schemaVersion: 1, enablementGeneration, settings }`. Missing settings yield disabled defaults with all categories neutral. Settings are strictly parsed and copied before queuing a write. Provider changes always discard consent and disable filtering, even when a caller tries to grant consent in that same write. Select provider/model first, then accept the disclosure in a separate write. Enabling, disabling, provider/model changes, and consent changes increment the generation. Preference-only writes preserve it so retained classifications can be re-evaluated.

The explicit legacy configuration is schema 0 with exactly `schemaVersion`, `enabled`, `categoryModes`, `provider`, `model`, `dailyRequestLimit`, and `consent`. Its sequential migration to schema 1 adds `languages: ['en']` and `estimatedCostCap: null`, preserving every category mode, including neutral `show`. Both source and target shapes must validate before a non-secret backup is written. After committing v1, the backup is removed; a later successful v1 read also removes a leftover backup from an interrupted cleanup. No historical category aliases or guessed mappings are invented. Future/invalid schemas fail closed and remain untouched by ordinary operations; an explicit generation-checked `clearAll` can erase incompatible data.

## Reservation and reconciliation semantics

Task 11 is the **sole production writer**. Settings, credentials, reservations, reconciliation, status, and deletion share a promise queue keyed by the stable injected local-storage port. This serializes multiple callers and facades sharing that port in one worker; it is not a transaction across independent extension contexts or independently wrapped ports. Content/options must use task 11's broker rather than writing storage directly.

Call `usage.reserve` for **each outbound attempt**, including connection tests and retries. Supply a fresh opaque request ID with no post identity, text, URL, or digest. Await an accepted result before dispatch. Duplicate retained IDs are rejected rather than issuing an uncharged repeat. Only allowlisted reservation fields persist. The request cap is global across providers/tabs under the coordinator. Unknown, failed, cancelled, token-only, and unresolved outcomes retain attempts and their conservative cost reservations across worker restart. Cancellation is never a request refund.

Optional estimated caps require a known upper-bound estimate in the cap's currency, and known same-currency accumulated costs for every attempt that day. Otherwise reservation is refused with `estimated_cost_limit`; without a currency cap, request accounting still works and cost may be null (UI: “Cost unavailable”). Explicit complete reported `Usage.estimatedCost` plus currency settles an estimate once; attempts remain charged. Unknown usage retains the upper bound; mismatched currencies become unavailable, with no invented conversion. Pricing/usage normalization belongs to the trusted adapter/coordinator, not provider-controlled metadata. Estimates are local estimates, never a provider-enforced spending guarantee.

The ledger persists an epoch watermark and its original IANA timezone. It uses `max(now, watermark)`, so rollback and worker restart cannot reset a day twice. A new timezone passed to a reconstructed facade cannot silently reset an existing ledger. Midnight is calculated in the ledger's timezone, including daylight-saving transitions. Current and previous **calendar** day records remain available for late reconciliation; older records are pruned on the next read/reservation/reconciliation. Task 11 schedules these operations for timely retention cleanup. A large forward clock jump remains conservative until the wall clock catches up; user-initiated Clear all data resets accounting.

A failed browser operation may have committed. Unexpected port failures block ordinary operations in that worker with `storage_unavailable`, so no dispatch can proceed on ambiguous persistence. Explicit clear/disconnect recovery is still allowed. After successful recovery or reconstruction of the worker's ports, operation can resume from validated durable state. A failed reset is reported as failed, even if its credential deletion succeeded; the coordinator must keep filtering disabled, reload the persisted generation before retrying, and never claim all records were erased on a rejected operation.

## Reset ordering and memory lifetime

For pause, provider changes, consent withdrawal, disconnect, and clear: task 11 first increments its live generation, aborts queued/in-flight requests, and broadcasts restoration. It then awaits the corresponding storage mutation and adopts the returned persisted generation. Every async callback must check that live generation before dispatch, cache insertion, reconciliation, or DOM application. Storage mutation methods reject stale expected generations; memory cache and DOM guards remain the coordinator's responsibility.

`clearAll` validates the expected generation independently of the settings schema, clears memory, commits a disabled default-settings generation tombstone, clears the trusted session, and removes the owned usage and migration-backup records. Session deletion is attempted even if the local tombstone write fails. The minimal non-secret tombstone intentionally remains so callbacks from before reset cannot become current after worker restart. Known future-generation envelopes require their stored generation; incompatible records without a generation use zero for explicit recovery. Ordinary reads never silently reset them.

`disconnect` increments the generation, disables and removes selected-provider configuration/consent, erases that provider's session key, and clears cache/diagnostics. Credential deletion is attempted even if settings are incompatible or writing the disabled state fails, after checking the generation. Global usage reservations deliberately survive disconnect/reconnect to prevent bypassing the daily limit. Individual contract `clear` methods are lower-level primitives; the `CLEAR_DATA` command must use `clearAll`, not a sequence of isolated clears.

The memory cache is a 500-entry LRU with a 30-minute insertion TTL. Optional bounds may only reduce these maxima. Reads prune expired entries without extending retention; clock rollback clears the cache. All keys/results are validated, metadata must match, and results are detached copies. Partial extraction always misses and is never stored. The coordinator rebinds request IDs, rejects stale generations, and clears on provider changes/reset. No cache key, digest, classification, or raw post text is persisted. The diagnostics ring retains at most 200 strict allowlisted events in worker memory; append/read copy values, reset/disconnect clears it, and schema validation rejects extra text/credential fields. Scheduling, diagnostics export version metadata, sender checks, and browser permission/consent enforcement remain task 11 responsibilities.

## Validation and next integration actions

Actual Windows checks on the pinned Node/pnpm toolchain:

| Command | Actual result |
| --- | --- |
| `pnpm install --offline --frozen-lockfile` | Pass; workspace links updated without new external dependencies |
| `pnpm exec vitest run packages/storage/tests` | Pass: 49 tests in 5 files |
| Storage fixture scoped Vitest | Pass: 10 tests |
| `pnpm test` | Pass: 157 Vitest cases and 12 Node boundary tests, 169 total |
| `pnpm lint` / `pnpm format:check` | Pass, including dependency boundaries |
| `pnpm typecheck` | Pass: packages, extension, Astro; zero diagnostics |
| `pnpm build` | Pass: static website and Chrome/Firefox development extension builds |
| `pnpm package:chrome` / `pnpm package:firefox` | Pass: development ZIPs |
| `pnpm artifacts:check` | Pass: manifest/local-code/basic-pattern checks and ZIP byte parity |
| `pnpm docs:check` | Pass: local links and code fences in 33 Markdown files |
| `pnpm test:integration` | Expected failure: NOT IMPLEMENTED; underlying placeholder script exits 2, not an integration pass |

The committed tests are the reproducible evidence. They cover racing reservations, worker recreation, retry accounting, unknown outcomes, pricing, day rollover/rollback, DST, retention, schema migration, future-schema preservation and explicit deletion, ambiguous write failures and deletion recovery, status/reset races, stale callbacks, isolation failure, session lifecycle simulations, and memory/privacy bounds. Generated outputs are ignored. No live browser/provider requests, real credentials, provider-policy acceptance, release calibration, deployment, or publishing were performed. Hosted CI and non-Windows execution were not run locally.

Task 11 must inject browser wrappers from an accepted capability decision, retain a single background writer/port, wire generation/abort/restore ordering, invoke retention primitives, enforce sender/provider permissions and consent, and build dynamic public status fields such as working/circuit state and hidden count (the storage snapshot starts that count at zero). Task 02's persistent-install restart and interactive host-permission gates must close before production credentials are enabled. Provider support/security decisions and full runtime integration remain separate tasks.
