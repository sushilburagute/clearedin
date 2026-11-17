# Task 12: validation preparation and evidence limits

Status: **partial**, 2026-11-17. Repository regression checks exist; independent product evaluation is not complete.

The audit adds local integration regressions and `tests/evaluation/metrics.mjs`. The evaluation CLI validates metadata, two distinct annotator identifiers, adjudication flags, category IDs, unique examples, split membership, and source/template separation. It reports held-out hide precision, false-hide rate, category recall, abstention, coverage, Wilson 95% intervals, p95 latency, attempted requests, and cost per 100 attempts (null when costs are incomplete).

Run `pnpm evaluate input.json report.json` after arranging independently annotated input. Missing arguments exit 2; invalid data exits 1; unmet numerical gates exit 2. The CLI does not call providers or produce annotations. A positive numerical result explicitly does not approve release or attest that the annotation identities are independent humans.

Input shape (illustrative; one row is not enough to meet the gates):

```json
{
  "schemaVersion": 1,
  "provider": "accepted-provider-id",
  "model": "accepted-model-id",
  "promptVersion": "frozen-prompt-version",
  "taxonomyVersion": "1.0.0",
  "thresholdVersion": "frozen-threshold-version",
  "sourceCommit": "accepted-source-sha",
  "runDate": "2026-11-17",
  "browser": "record-exact-browser-and-os",
  "hardware": "record-reference-machine",
  "annotators": ["assigned-independent-annotator-a", "assigned-independent-annotator-b"],
  "rows": [{
    "id": "permissioned-example-001",
    "templateGroup": "source-template-group-001",
    "split": "test",
    "adjudicated": true,
    "labels": ["job_posting"],
    "predictions": ["job_posting"],
    "expectedHidden": true,
    "actualHidden": true,
    "abstained": false,
    "latencyMs": 1000,
    "attempts": 1,
    "costUsd": null
  }]
}
```

Use one report per frozen provider/model/threshold and preference profile. Rows contain evaluation metadata and labels, not raw feed text or credentials. The automated gate conservatively requires at least 500 total examples, 200 held out, and 30 held-out positives per remote category, in addition to the documented percentage criteria. Zero hides/positives never count as a passing percentage. Local sponsored detection needs separate DOM evidence. Record raw evaluation outcomes accurately; abstained rows in this remote evaluation cannot hide.

Pending: independently annotated corpus, adjudication, provider execution with explicitly budgeted access, development-only calibration, frozen held-out results, per-profile acceptance, permissioned/live selector fixtures, packaged-browser accessibility, and measured performance/reliability targets. No accuracy percentage, actual provider cost, latency claim, or independent security sign-off is inferred from fixture tests.
