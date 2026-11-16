# Task 12 validation evidence

Status: **partial; not recommended for public release**. Date: 2026-11-16.
Baseline: `3b54066cb2bfad6d81b035ad51f9dae0371f2544`; task 12 changes are in the accompanying PR. Final release evidence must record its accepted commit, not reuse this baseline as proof for later code.

## Delivered and measured

- `packages/test-fixtures/src/evaluation/corpus.ts`: frozen `synthetic-evaluation-1` corpus, 540 provisional synthetic rows, 270 development and 270 held-out rows. Each category has at least 40 positive rows overall. Negative, overlap, ambiguity, injection, partial and unsupported-language cases are included.
- Template families are disjoint across splits, but the 20 numbered variants per category/template are correlated, **not 20 independent semantic samples**. This is harness preparation, not a sufficient quality corpus. Generated labels are explicitly `generated-unreviewed`.
- `tests/evaluation/metrics.ts`: hide precision, false hides using expected-visible denominator, clear-example category recall, Wilson 95% intervals, abstention, coverage, nearest-rank p95 latency, attempts including retries, cost per 100 attempts. Unknown cost and empty denominators remain null. Synthetic evidence cannot pass quality gates. Confidence-bound gates additionally prevent tiny perfect samples from passing.
- `tests/evaluation/evaluation.test.ts`: six tests passed with `pnpm.cmd exec vitest run tests/evaluation`. Includes all 14 existing deterministic policy fixtures, covering protect-over-hide, reveal, no consent, local sponsored facts, partial extraction, and abstention. This is policy regression evidence, not model precision/recall evidence.
- Formatting: `pnpm.cmd exec prettier --write packages/test-fixtures/src/evaluation tests/evaluation` completed.
- Runner: Windows, Node v24.6.0, Vitest 5.1.0. Node is below the project's >=24.11.0 target; supported-toolchain CI remains required.

## Annotation and evaluation protocol

The coordinator/product owner must appoint two different annotators and an adjudicator. Each receives text and taxonomy without the generated label or the other annotator's answer. Preserve both original annotations, sufficiency, ambiguity, disagreement and adjudication records. No independent human annotation has occurred here.

Replace correlated numbered variants with diverse permissioned/synthetic source families before model-quality evaluation. Keep all related source/template families in the same split. Version and checksum the accepted corpus and annotation ledger. Freeze at least 200 held-out examples before calibration; changes invalidate prior held-out results. Retain at least 30 positives per category and report effective independent sample sizes, not only generated row counts.

Use development data only to choose per-provider/model thresholds. Freeze threshold, adapter, taxonomy and prompt versions before held-out execution. Run all-visible, job-seeker, technical-focus and overlapping hide/protect profiles. Feed observed labels and final deterministic visibility into `summarize`; never substitute gold labels as predicted model outputs. Record browser/OS, accepted source SHA, exact model ID, corpus version, settings profile, retries, actual token/question usage and verified currency prices. Unknown usage/cost stays unknown. Only adjudicated live evidence may be submitted to `assessQuality`; provenance must be verified by the reviewer, not inferred by this numerical helper.

## Release gates and findings

| Gate / finding | State | Accountable role / next action |
| --- | --- | --- |
| Six evaluation harness tests / 14 deterministic policy expectations | Passed locally | Integration owner reruns at accepted source |
| >=95% hide precision, <=2% false hides, >=80% per-category clear recall | Pending | Evaluation owner obtains independently annotated diverse data and live provider outputs |
| Human annotation and adjudication | Pending, release blocking | Product owner appoints two annotators and adjudicator |
| Threshold calibration | Pending | Evaluation owner freezes development-only profiles; retain experimental 0.90/0.70, do not promote to evaluated |
| Browser/OS and credential isolation | Pending, high severity release blocker | Runtime owner executes packaged matrix after task 02 feasibility evidence |
| Keyboard, focus restoration, screen readers, zoom and visual accessibility | Pending | Accessibility owner executes protocol below |
| p95 policy <=50ms, classification <=2s, 10s deadline | Pending | Performance owner records reference machine and actual measurements |
| 200-post scroll trace, no >50ms extension main-thread task | Pending | Performance owner records packaged browser traces |
| Pause <=100ms / cross-tab <=500ms | Pending | Runtime owner measures active and suspended tabs |
| 30-minute bounded scrolling, cache <=500 / queue <=50 | Pending | Performance owner records peak resource counts |
| Consent/withdrawal, restart, multi-tab limit, key/data isolation | Pending packaged validation | Runtime owner provides network/storage assertions against actual packages |
| Critical/high findings resolved | Pending | Release owner verifies evidence; absence of runs is not absence of defects |
| Public release approval | Pending | A separate person/product owner makes the decision |

No provider calls or secrets were used. No release thresholds are proposed as validated. A model-quality or performance percentage cannot honestly be supplied from these unit tests. Component tests and future integration tests do not replace packaged-browser measurements.

Changed files are the corpus, metrics, regression tests, this report and the accessibility/performance protocols. No shared contracts or production defaults changed. Next integration action: rerun the harness against the accepted candidate, finish annotation, and execute the pending matrix before requesting a release decision.

## Candidate identity and rerun

At validation time `git rev-parse HEAD` returned `3b54066cb2bfad6d81b035ad51f9dae0371f2544`; the working tree was dirty with tasks 10–13 in progress. These results apply to that working tree's task 12 files, not to a committed final release candidate. The integration owner must record `git rev-parse HEAD` and `git status --short` after the final commit and rerun broad checks before associating this report with a release artifact.

Additional check: `pnpm.cmd exec tsc --noEmit -p tsconfig.packages.json` passed locally. Targeted ESLint for the corpus and evaluation harness passed. No browser, provider or latency measurements are claimed.
