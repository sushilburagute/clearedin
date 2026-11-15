# Implementation plan

This is an ordered backlog with exit criteria, not a delivery-date commitment. One person can fill multiple roles, but each release gate needs a named owner before launch.

For execution, use the [subagent assignment guide](build-assignments.md). It maps these phases to 13 scoped briefs with dependencies, exclusive file ownership, a three-worker schedule, and concrete handoffs. The guide permits minimal scaffolding before feasibility probes while keeping live-access and production gates open until proven.

## Phase 0 — Prove the risky assumptions

Owner: technical lead, with product owner handling provider/platform decisions.

1. Review the platform restriction and distribution options in [production readiness](production-readiness.md). Record the public-release decision separately from technical feasibility.
2. Build disposable DOM fixtures and a minimal Chrome/Firefox extension spike. Demonstrate discovery, text extraction, collapse, reveal, recycled DOM-node handling, and restoration on navigation.
3. Test one synthetic classification through each provider from the actual packaged browser background context. Verify API access, required host permissions, supported authentication, timeout behavior, and output shape. Use tester-supplied credentials locally; keep keys out of fixtures and logs.
4. Test Jev independent category questions, including ambiguous multi-category text. Record actual score semantics; do not assume a generic chat API interface.
5. Choose session-only credential handling or a different deployment boundary based on provider guidance and browser results. Record any unsupported provider/browser pair.
6. Create an initial labeled corpus and measure plausible accuracy, latency, and cost before choosing model defaults.

Exit: feasibility report attached to the relevant decision records; browser manifests and provider configuration proven; no assumption that installing a framework proves extension compatibility. If direct BYOK fails, evaluate a user-controlled companion service or a separately designed backend before proceeding with that adapter.

## Phase 1 — Establish the monorepo

Owner: engineering lead.

Create the layout in [architecture](software-architecture.md). Pin a supported Node LTS, pnpm, framework versions, and lockfile. Configure strict TypeScript, linting, formatting, workspace dependency rules, unit tests, and CI. Build a static website shell and browser-specific extension packages. Add schema validation and browser API wrappers before feature work.

Exit: clean checkout builds website and both extension artifacts reproducibly; no secrets or remote executable code in artifacts. Establish the intended commands from [testing](testing-and-evaluation.md).

## Phase 2 — Build user control before remote inference

Owner: extension engineer and design owner.

Implement category settings, precedence, pause, placeholder/reveal, onboarding, consent, and extraction with a fake classifier. Use the same fake classifier to power a synthetic website demo. Build accessible popup and options screens. Add versioned settings and migration tests.

Exit: all core interaction stories work offline against fixtures; route restrictions, fail-open behavior, node reuse, and pause restoration pass browser checks. No real post content is sent by this milestone.

## Phase 3 — Integrate providers and cost controls

Owner: integration engineer.

Implement Jev, OpenAI, and Anthropic independently behind the normalized contract. Add bounded queue, deduplication, cache, credential broker, retry rules, daily request accounting, and provider/model-specific thresholds. Complete adversarial input and output-validation tests. Never silently route to another provider.

Exit: all supported provider/browser pairs pass synthetic live tests; labeled evaluation meets the proposed quality gates; pause and consent revocation invalidate in-flight results. Unsupported pairs are visibly unavailable, not silently degraded.

## Phase 4 — Private beta and website completion

Owner: QA/release owner and product owner.

Complete privacy and support pages, installation guides, demo, provider onboarding, accessibility review, and responsive website checks. Recruit consenting testers only after reviewing the platform risk. Evaluate long sessions, DOM drift, multiple tabs, worker restarts, and inaccurate hides. Obtain feedback without collecting feeds automatically.

Exit: beta report records failures, resolutions, known limitations, browser/model versions, and evidence for every quality target. All critical/high findings resolved or release blocked. Any narrowed scope is reflected in the website and store descriptions.

## Phase 5 — Production distribution

Owner: release owner; product/privacy owners approve factual disclosures.

Complete the [release checklist](production-readiness.md), prepare signed browser packages and reviewer materials, deploy the static website, and run packaged-artifact smoke tests. Submit store packages only when policy and privacy gates are resolved. Store review timing is outside the engineering estimate.

Exit: actual store listings, tested download links, public privacy/support pages, release notes, and working incident procedures. A website can launch earlier as a clearly labeled preview without claiming extension availability.

## After v1

Prioritize custom category definitions, additional languages, local inference, richer keyword rules, and optional encrypted sync based on evidence. Each changes evaluation or privacy requirements. Network interception remains a separate architectural decision, not an automatic follow-up task.
