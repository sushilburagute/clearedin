# Task 11: local integration and remaining production wiring

Status: **partial**, 2026-11-17. This is a development implementation, not a working live-feed filter.

Implemented:

- A production background broker validates browser-supplied extension ID, exact packaged-page URL, tab/frame metadata, supported feed route, and surface-specific strict schemas. Content cannot set credentials, read settings, clear data, or run provider tests. Popup privileges are restricted separately.
- Settings mutations are serialized across callers, use the existing storage facade, survive reconstructed background owners, and broadcast after persistence. Options and popup now use a real validated transport. Categories and limits persist locally; credentials and provider setup remain unavailable.
- The provider registry exposes separate component factories and exact endpoint restrictions, disables redirects and ambient credentials, and marks every production provider unavailable. No silent provider fallback exists. Production entrypoints import no provider execution code.
- An injected coordinator checks consent/provider/model/generation and availability, recomputes content digests, reserves usage durably before inference, rechecks after asynchronous boundaries, and reconciles usage. Failed attempts retain their reservation. Explicitly no automatic retry is performed; a later user request is a new attempt. Three consecutive inference failures open a 30-second circuit.
- A shared scheduler caps concurrency at two, pending jobs at fifty, and subscribers per deduplicated job at one hundred. It enforces a ten-second deadline from scheduler admission, includes complete extraction/configuration in cache identity, rebinds subscriber IDs, cancels unused work, and ignores late completions after invalidation. Pre-scheduler admission is separately bounded to one hundred concurrent callers; end-to-end timing under slow browser storage remains unmeasured.
- An injected content session combines current status, DOM identities, policy, reveal, health, and teardown. Synthetic integration tests exercise the actual DOM adapter with the fake classifier. Pause restores host markup and rejects stale responses. The adapter owns its live region until disposal, when it removes all owned markup.

`pnpm test:integration` is now a real **local integration suite**, not the previous exit-2 placeholder. It covers broker authorization and persistence, message correlation, scheduler limits/dedup/cache/cancellation, durable accounting and withdrawn-consent gating, synthetic DOM restoration, and the website demo. It is intentionally not labelled packaged-browser coverage.

Remaining engineering and evidence:

1. Close task 02's persistent-install restart and interactive permission gates, and provider-specific client credential decisions. Accepted provider models/endpoints and calibrated thresholds are required before production execution.
2. Connect the injected coordinator to the production broker with trusted session credentials, actual permission checks, synthetic connection tests, public working/limited/error states, and tab-scoped subscription ownership. The existing production broker currently rejects all classification and credential commands.
3. Connect the content-session lifecycle to production entrypoints with verified feed-root/SPA discovery, cross-tab broadcasts, tab unload cancellation, suspension/reconnection, and hidden-count reporting. The production content entrypoint remains inert; no live post text is read or transmitted.
4. Test the built extension in both packaged browsers, including restart, multi-tab limits, permissions, focus, recycled nodes, and natural suspension. Existing task 02 probe evidence is historical and does not validate this new broker.
5. Measure end-to-end deadlines, 200-post performance, memory bounds over 30 minutes, and recovery under real storage/network failures. Local injected tests are not measurements of those targets.

Manifest change: required `storage` only; no optional provider origins or remote permissions added. Firefox's no-data declaration still reflects the disabled remote path. Every live provider remains gated; no credential facility is enabled by inference from unit tests.

Final local validation: 35 integration tests passed, strict integration/extension typechecks passed, and both browser packages passed ZIP/build parity checks. A build failure revealed WXT auto-import injection into a shared storage function's `browser` parameter; explicit-import-only transform configuration resolves it. Resume rediscovery and independent text hashing for inference cache identity have regression coverage. These results do not replace packaged-browser execution.
