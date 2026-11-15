# 05 — Feed extraction and reversible rendering

Status: unassigned; no implementation started by this brief.

## Dependencies

01 and 02 accepted. Can build against the frozen policy interface while 03 completes; do not redefine policy.

Read the [assignment guide](../build-assignments.md) first. Required specifications: [software-architecture.md](../software-architecture.md), [design-guidelines.md](../design-guidelines.md), [classification-and-rules.md](../classification-and-rules.md).

## Copy-ready assignment

> Implement task 05: Feed extraction and reversible rendering in the ClearedIn repository. Read this entire brief and the shared assignment guide. Confirm prerequisite handoffs are present before dependent work. Stay within the ownership boundary, use frozen shared contracts, and complete the implementation and relevant tests. Do not spawn further agents, publish, deploy, or expand product scope. If credentials, browser access, or a prerequisite is missing, complete independent local work and report the remaining evidence explicitly. Return the required handoff summary.

## File ownership

`packages/linkedin-adapter/`; `packages/test-fixtures/src/dom/`; colocated DOM tests. Task 11 owns the production content-script entrypoint.

Paths are the proposed task-owned layout; task 01 may normalize framework-generated names once and publish the mapping before parallel work starts. Do not edit another task's paths without an explicit handoff from the integration owner.

## Deliverables

- Implement feed-only discovery, bounded mutation handling, visibility/lookahead gating, and normalized text extraction.
- Keep author metadata, comments, messages, tracking URLs, and irrelevant surrounding text out of provider input.
- Track local post identity, digest inputs, node generation, completeness, repost context, and reliable sponsored markers.
- Expose lifecycle callbacks to the coordinator without owning networking or credentials.
- Implement collapse placeholders, accessible reveal, focus-aware deferral, exact attribute/style restoration, and teardown.
- Handle recycled nodes, text expansion, route changes, extension mutations, detached nodes, and ambiguous selectors. Use synthetic fixtures; label live-selector compatibility unverified unless actually demonstrated.

## Acceptance criteria

- Old results never collapse a reused node or re-hide a revealed post.
- Partial/image-only/ambiguous posts remain visible under the documented rules.
- Hidden content is not tabbable; focused posts are not collapsed until focus leaves.
- Teardown restores host state and releases observers/listeners.
- No automatic clicks, scrolls, link fetches, private API requests, or credential handling.

## Handoff

Export discovery/extraction/render/restore/dispose API, fixture coverage, selector assumptions, and browser limitations. Task 11 wires it into the real content entrypoint.

Include changed files, exported interfaces, commands and actual results, evidence location, limitations, and next integration actions. Report commits/branches if the coordinator supplied an isolated checkout. Never claim a pending live, browser, or release check passed.

