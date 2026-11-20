# Testing and evaluation

Run the [development checks](../README.md#commands) with the pinned toolchain. The integration suite exercises injected browser ports, storage, scheduling, real policy, synthetic feed markup, and the built demo. Use the browser checks below for installed-extension behavior.

## Browser checks

After `pnpm package:chrome` and `pnpm package:firefox`, run these from the root in sequence. Supply a browser executable after its name for a non-default installation.

```sh
node experiments/browser-feasibility/browser-runner.mjs chrome --settings
node experiments/browser-feasibility/browser-runner.mjs firefox --settings
```

These checks open disposable profiles, change a category, reopen settings, and confirm that Clear all data restores the defaults. The separate [credential feasibility probe](../experiments/browser-feasibility/README.md) tests a synthetic credential, sender isolation, and background termination.

For packaged release testing, use the [accessibility protocol](../tests/accessibility/README.md) and [performance protocol](../tests/performance/README.md). They specify the browser matrix, keyboard and screen-reader flows, 200-post timings, 30-minute scroll trace, and restart/cancellation races. Record versions, sample sizes, and actual results. See the [latest verification record](completion-audit.md) for existing coverage.

## Evaluating a provider

For an explicitly authorized live smoke check, use the adapter’s fixed synthetic request. The [Jev test](../packages/providers/src/typesafe/tests/live.test.ts) requires `CLEAREDIN_LIVE_TYPESAFE=1` and a securely supplied `TYPESAFE_API_KEY`. The [OpenAI](../packages/providers/src/openai/smoke.ts) and [Anthropic](../packages/providers/src/anthropic/smoke.ts) helpers take an opt-in flag, credential, and injected network client. Each check may incur a charge. Keep keys out of command arguments and logs.

Use independently annotated synthetic or permissioned examples. Have two annotators label them and adjudicate disagreements. Split by source or template group before calibration. Freeze provider, model, prompt, taxonomy, threshold, and preference profile before running the held-out set.

Run `pnpm evaluate input.json report.json` with separate input and output files. The CLI evaluates recorded outcomes without contacting a provider. Include the following fields in a version 1 input.

| Level | Required fields |
| --- | --- |
| Dataset | `schemaVersion`, `provider`, `model`, `promptVersion`, `taxonomyVersion`, `thresholdVersion`, `sourceCommit`, `runDate`, `browser`, `hardware`, two distinct `annotators`, and `rows` |
| Example | Unique `id`, `templateGroup`, `split` (`development` or `test`), `adjudicated`, `labels`, `predictions`, `expectedHidden`, `actualHidden`, `abstained`, `latencyMs`, `attempts`, and `costUsd` (null if unknown) |

Require at least 500 examples overall, 200 held out, and 30 held-out positives per remote category. The numerical gates require hide precision ≥95%, false-hide rate ≤2%, and per-category recall ≥80%. Local sponsored detection needs separate DOM evidence. Review coverage, abstentions, confidence intervals, p95 latency, and cost per 100 attempts alongside the scores. An undefined denominator cannot pass.

Invalid data exits 1. Missing arguments or unmet numerical gates exit 2. Numerical success still requires human review of annotation independence and provenance. The [CLI regression fixtures](../scripts/tests/evaluation.test.mjs) provide example input fields, and the [metrics implementation](../tests/evaluation/metrics.mjs) defines the calculations.
