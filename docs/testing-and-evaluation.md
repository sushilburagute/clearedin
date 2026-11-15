# Testing and evaluation

All thresholds below are proposed release criteria. No tests have been implemented or run yet. Record hardware, browser versions, extension build, model ID, prompt/taxonomy versions, sample size, and date with every result.

## Test layers

1. Pure unit tests for visibility precedence, uncertain/invalid output, request accounting, cache keys, and settings migrations. Include overlapping categories and all modes.
2. DOM fixture tests for multiple post shapes, missing IDs, reposts, truncated text, sponsored markers, changing text, nested unrelated content, recycled nodes, and exact restoration.
3. Adapter contract tests using fixed synthetic provider responses: successful typed results, refusal, malformed/oversized body, unknown labels, nonfinite scores, missing usage, authentication errors, timeout, cancellation, and retries.
4. Browser integration tests for content/background messaging, host permissions, consent, options, popup, multi-tab limits, lifecycle restarts, focus, reveal, and navigation. Use actual packaged extension builds.
5. Opt-in live provider smoke tests with synthetic content, limited spend, and secrets supplied outside the repository. Never require personal keys or real LinkedIn data in ordinary CI.
6. Website checks for build, links, responsive layout, synthetic demo, accessibility, privacy/setup accuracy, and installation states.

Required regressions include high hide scores combined with `ambiguous` or `refused` abstention (remain visible), identical text with different extraction completeness (no unsafe cache reuse), and popup Pause/Resume authorization (restore posts without granting credential access).

## Classifier evaluation

Start with at least 500 synthetic or permissioned English posts, including at least 30 positive examples per category, negatives, ambiguous cases, overlapping labels, prompt injection, truncated text, and unsupported-language examples. Multi-label examples can count toward several categories. Split by source/template to avoid near-duplicate leakage; keep at least 200 examples as a held-out test set. Increase the sample when per-category evidence is too sparse.

Two annotators label category membership and sufficiency independently using the taxonomy. Adjudicate disagreements and preserve an ambiguity label. Evaluate multiple preference profiles, including all visible, job seeker, technical focus, and overlapping protect/hide rules. Evaluate final visibility decisions in addition to model labels.

Definitions: hide precision = correctly hidden / all hidden; false-hide rate = incorrectly hidden / all expected-visible posts; category recall = true positives / all labeled positives. Report abstention and coverage separately so a classifier that shows everything cannot pass on precision alone. Report per-category results and uncertainty intervals alongside aggregate metrics.

Proposed gates: >=95% hide precision, <=2% false-hide rate, and >=80% recall on clear examples of each enabled hide category. If evidence cannot support a category/provider threshold, disable automatic hiding for that combination or gather more data. Preserve protect-over-hide cases in a deterministic regression suite with 100% pass expected. No percentage gate should pass on zero predicted hides or an inadequate denominator.

Evaluate Jev and LLM scores separately, select thresholds on development data, and freeze them before held-out testing. Report cost per 100 attempted classifications using actual usage and verified prices, including retries. Do not infer confidence calibration from a provider's marketing language.

## Performance and reliability targets

On a recorded mid-range reference machine and a 200-post synthetic feed:

- Local policy decision after a cache hit: p95 <=50ms.
- Classification completion: target p95 <=2 seconds under the tested provider/network conditions; 10-second hard logical deadline. Pending posts stay visible regardless.
- No extension-caused main-thread task exceeding 50ms in the measured scroll trace; use bounded extraction batches.
- Pause/reveal restores an active-feed post within 100ms; cross-tab restoration target <=500ms for active tabs. Suspended tabs restore immediately on resume before filtering.
- No unbounded node/listener growth during a 30-minute synthetic scrolling session; cache <=500 entries and queue <=50.
- Zero remote post requests before consent, after withdrawal, or on excluded routes in controlled network assertions.
- Daily request limit holds across multiple tabs and worker restarts, including failed/uncertain requests.

These targets are not product claims until measured. Use a provider stub for reproducible local timing and a separately reported live-provider measurement.

## Browser and accessibility matrix

At release, record exact versions for Chrome stable and previous stable on Windows/macOS, Firefox stable and current ESR on Windows/macOS, plus a Linux smoke test where supported. Validate manifest/background differences and store-packaged builds. If the team cannot support this matrix, narrow public support claims before release.

Check keyboard-only onboarding and settings, focus inside posts when collapse is due, screen-reader placeholder labels, 200% zoom, contrast, high contrast/forced colors, and reduced motion. Use automated accessibility checks plus manual screen-reader testing. Browser page tests alone do not establish extension compatibility.

## Intended CI commands

When scaffolding is implemented, provide root scripts named `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm package:chrome`, `pnpm package:firefox`, and `pnpm docs:check`. These commands do not exist yet. Live provider evaluations are separately invoked and budgeted, not an unconditional PR check.

CI installs from the frozen lockfile, runs checks, scans artifacts for secrets and remote code, validates manifests, builds website and packages, and records checksums. Store credentials are available only to the protected release job; untrusted pull requests cannot access them. Prompt/model/taxonomy changes require the evaluation report in addition to ordinary CI.
