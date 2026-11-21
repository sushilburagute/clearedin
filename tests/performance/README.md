# Packaged performance and reliability protocol

A short installed Firefox measurement is recorded below. The full browser matrix, live provider latency, long-running memory and reference-hardware acceptance remain open.

Use a 200-post synthetic feed. Record source/package checksums, CPU/RAM/OS, browser, adapter/model, taxonomy/prompt/threshold versions and network conditions. Pending posts must stay visible.

Measure distributions, sample counts and p95 for cache-hit policy (<=50ms), classification (target <=2s, hard deadline 10s), reveal/pause (<=100ms), and active cross-tab restoration (<=500ms). Keep fake transport measurements separate from live provider latency/cost. Include timeout/cancellation and retried requests.

Run a 30-minute synthetic scroll with recycled and removed nodes. Capture a main-thread trace (>50ms extension tasks fail), cache and queue high-water marks (<=500 and <=50), retained nodes/listeners and heap snapshots before/after forced cleanup. Compare a no-extension baseline. Archive traces; do not infer performance from implementation constants.

Run controlled network assertions before consent, during filtering, after withdrawal, on route exit and after restart; verify zero disallowed requests. Race multiple tabs against the daily limit and suspend/restart the worker after reservation but before response. Confirm reservations survive and uncertain attempts remain accounted. Pause, clear data and recycle nodes while callbacks are delayed; no stale callback may hide a post.

Every result needs expected/actual values, sample size, environment, repro, severity and owning component. Missing matrix cells stay pending.

## November 21, 2026 — installed Firefox on a synthetic home feed

The 200-card run exposed a discovery bug when more cards arrived than the pending queue could process. The walker now pauses until there is room. A [200-post regression test](../../packages/linkedin-adapter/tests/adapter.test.ts) checks that every card reaches the intersection observer.

| Measurement | Samples | Median | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| No-extension scroll frame interval | 120 | 6.06 ms | 6.06 ms | 6.08 ms |
| Enabled-extension scroll frame interval | 120 | 6.06 ms | 6.06 ms | 6.08 ms |
| Reveal button handler through visible layout | 20 | 2 ms | 4 ms | 4 ms |
| Pause from settings through restoration in the feed tab | 20 | 34 ms | 64 ms | 104 ms |

The pause and reveal p95 values met the 100 ms target on this host. One pause took 104 ms. The frame samples describe one short headless scroll. A main-thread trace, a 30-minute scroll with node recycling, heap retention, live API timing and routine measurements on Chrome are still due.

**Environment.** Temporary installation in headless Firefox 160.0.1, Windows 10.0.26300, Intel Core i7-13650HX, 23.7 GiB RAM, 1366 × 683 CSS pixels at DPR 1. Built with Node 24.22.3. Firefox ZIP SHA-256 was `201b970fbe7dbe354c655a1daca2f107dcfe2f55bddee7cc70cee088e1e6894f`. The TypeSafe adapter used `jev-1.14.0` with local deterministic responses and the preview thresholds. The timing run sent 244 synthetic requests across initial filtering and repeated pause/resume, representing 168 distinct organic texts. No sponsored text reached the fixture.

### Reproduce the exercise

1. Build the Firefox package. Use a disposable profile and a loopback-only HTTP CONNECT proxy serving local HTTPS fixtures for `www.linkedin.com` and `api.typesafe.ai`. Reject all other destinations and disable direct proxy failover. Trust the test certificate only in this profile. Use a dummy key.
2. Serve a standard HTML page at `/feed/?sort=recent` with a single `main > [role="feed"]` element containing 200 `article.feed-shared-update-v2` cards. Give each a unique activity URN and a short, uniquely numbered sentence inside `.update-components-text`. Mark every tenth card with `.update-components-actor__sub-description` containing “Promoted”. Give cards and placeholders a minimum height of 104 CSS pixels.
3. Before installing the extension, scroll the foreground tab from top to bottom in 120 equal viewport-position steps, one per `requestAnimationFrame`. Record adjacent callback timestamps. Install the package, allow the TypeSafe host and Firefox data permissions in the disposable profile, configure the dummy session key, select **Hide** for Product launch, and explicitly consent and enable. Set a high synthetic request budget to allow repeated restores. For each local System One request, use the requested model name and answer the sufficiency and product-launch questions with a noul score of 1 and all other questions with 0. Return integer dummy token counts. Repeat the same scroll with the extension enabled.
4. Scroll to 20 evenly spaced positions. At each, wait for a visible placeholder. Record `performance.now()`, activate its Show button, synchronously read the original article's `offsetHeight`, require a visible result, and record elapsed time. This measures handler plus layout time.
5. For each of 20 pause cycles, return to the top, wait for at least two hidden articles, and attach a feed-tab mutation observer for changes to `hidden`. From the separate settings tab record `performance.timeOrigin + performance.now()` immediately before sending the normal pause command. Record the corresponding feed timestamp when the observer first finds zero hidden articles, then resume. Calculate median and p95 with nearest ranks. Inspect the fixture's request log for sponsored text.
