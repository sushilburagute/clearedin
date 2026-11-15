# ClearedIn documentation

Status: implementation baseline, updated 2026-11-16. Task 01 adds the monorepo foundation, app shells, shared contracts, fixtures, and automated checks. Filtering, provider integration, live-browser feasibility, and production infrastructure remain future work. See the [foundation handoff](evidence/01-foundation.md). “ClearedIn” is a working name derived from the repository.

ClearedIn gives people control over the categories they see in their LinkedIn home feed. A browser extension extracts post text, asks a user-selected AI provider for category judgments, and applies the user's visibility rules locally. The website explains the product, demonstrates it with synthetic content, and provides installation and support documentation.

The requested providers are **TypeSafe Jev, OpenAI, and Anthropic**. Jev is a typed judgment model, not a synonym for a chat completion API. All three get separate adapters behind one classification contract.

## Reading order

1. [Product requirements](product-requirements.md): scope, user stories, acceptance criteria, and exclusions.
2. [Implementation plan](plan.md): dependencies, milestones, and delivery gates.
3. [Design guidelines](design-guidelines.md): website, extension, accessibility, and interaction behavior.
4. [Software architecture](software-architecture.md): monorepo, runtime boundaries, extraction, and state.
5. [Classification and rules](classification-and-rules.md): taxonomy, overlap, confidence, and visibility precedence.
6. [Provider integrations](provider-integrations.md): Jev and LLM adapters, credentials, limits, and failures.
7. [Data contracts](data-contracts.md): messages, settings, persistence, and versioning.
8. [Security and privacy](security-and-privacy.md): data flow, threat model, consent, and key handling.
9. [Testing and evaluation](testing-and-evaluation.md): browser coverage and measurable release criteria.
10. [Production readiness](production-readiness.md): distribution, policies, deployment, and release checklist.
11. [Operations runbook](operations-runbook.md): diagnostics, incidents, and recovery.
12. [Decisions and open questions](decisions-and-open-questions.md): assumptions and unresolved choices.
13. [Sources](sources.md): primary references checked for this proposal.


## Assigning the build

Use the [subagent assignment guide](build-assignments.md) for 13 copy-ready work packages, dependency ordering, file ownership, and acceptance criteria. The foundation handoff defines the shared contracts downstream tasks must consume; the assignment board tracks implementation status.

## Baseline decisions

- TypeScript and pnpm workspaces; WXT + React for a shared extension; Astro for a static website. Task 01 installs and pins the foundation toolchain; its app shells are not a working filter.
- DOM extraction on the desktop home feed; no private LinkedIn API or response interception in v1.
- Chrome first for the feasibility spike, Firefox tested throughout and required for the intended v1 release. Publish separate browser packages.
- Models label content; deterministic application code makes show/hide decisions.
- Posts remain visible while classification is pending, uncertain, unavailable, or unsupported. Hidden posts retain a reversible placeholder.
- No ClearedIn account, feed backend, or key relay in the initial design. Direct BYOK access is provisional pending browser and provider security validation.
- All categories initially visible; users explicitly choose what to hide or protect.

## Material production constraints

LinkedIn's published policy prohibits extensions that scrape or modify its appearance. This proposal therefore does **not** establish that a public release is permitted. Resolve the platform and distribution position before a public launch; a local DOM approach does not remove that issue. See [production readiness](production-readiness.md).

Provider keys held by an extension are client-side credentials. They cannot be made equivalent to a server-side secret by hiding the settings field or encrypting with a bundled key. Provider access and credential custody require an explicit feasibility decision; see [security and privacy](security-and-privacy.md).

Numbers in these documents are initial engineering targets, not measured results. Checklist items remain open until implementation evidence exists. Changes to a shared rule belong in its canonical document and must update dependent documents in the same change.
