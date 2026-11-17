# Packaged performance and reliability protocol

State: pending; no reference-hardware measurements yet.

Use a 200-post synthetic feed. Record source/package checksums, CPU/RAM/OS, browser, adapter/model, taxonomy/prompt/threshold versions and network conditions. Pending posts must stay visible.

Measure distributions, sample counts and p95 for cache-hit policy (<=50ms), classification (target <=2s, hard deadline 10s), reveal/pause (<=100ms), and active cross-tab restoration (<=500ms). Keep fake transport measurements separate from live provider latency/cost. Include timeout/cancellation and retried requests.

Run a 30-minute synthetic scroll with recycled and removed nodes. Capture a main-thread trace (>50ms extension tasks fail), cache and queue high-water marks (<=500 and <=50), retained nodes/listeners and heap snapshots before/after forced cleanup. Compare a no-extension baseline. Archive traces; do not infer performance from implementation constants.

Run controlled network assertions before consent, during filtering, after withdrawal, on route exit and after restart; verify zero disallowed requests. Race multiple tabs against the daily limit and suspend/restart the worker after reservation but before response. Confirm reservations survive and uncertain attempts remain accounted. Pause, clear data and recycle nodes while callbacks are delayed; no stale callback may hide a post.

Every result needs expected/actual values, sample size, environment, repro, severity and owning component. Missing matrix cells stay pending.
