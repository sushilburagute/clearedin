# Production readiness and release

Status: all items are open. This document defines evidence needed to release; it does not assert compliance, store approval, or operational readiness.

## Platform and distribution decision

LinkedIn explicitly says it does not permit extensions that scrape, modify its appearance, or automate activity. A feed-hiding extension falls within the appearance-modification concern even if it avoids network interception and engagement automation. See [LinkedIn's published policy](https://www.linkedin.com/help/linkedin/answer/a1341387). Do not claim DOM-only processing makes the product compliant or account-safe.

Before public distribution, the product owner must document an appropriate platform/legal assessment and a viable launch route, including permission or partnership where applicable. If unresolved, keep development and demonstrations on synthetic fixtures and consider permitted sources or a standalone user-supplied-content experience. Neither browser store approval nor an account-risk disclaimer grants LinkedIn permission. This is a material product dependency, not a completed legal conclusion.

## Store preparation

Chrome requires accurate handling/disclosure of user data; review its [user-data policy guidance](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq). Mozilla requires transparent data practices and applicable consent; follow the [add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/). The Mozilla page reviewed on 2026-11-15 announces changes effective December 1, 2026: recheck the rules applicable on submission day, including manifest data declarations and consent UX.

Describe a single purpose: user-controlled feed category filtering. Disclose sending post text to the selected provider, explain each permission, and make privacy/support URLs accessible. Provide source/build instructions where required and reproducible reviewer steps using synthetic fixtures. Do not distribute real user credentials or private feeds to reviewers.

Choose publisher accounts, legal operator name, public support contact, product name, license, and trademark/non-affiliation wording before submission. Do not imply endorsement by LinkedIn, Mozilla, Google, or the model providers.

## Release checklist

| Gate | Evidence required | Accountable role |
| --- | --- | --- |
| Platform position | Written release decision and unresolved restrictions addressed | Product owner |
| Provider feasibility | Tested endpoints/auth/model IDs and client-key security decision for all advertised adapters | Technical lead |
| Product scope | Acceptance criteria pass; actual browser/language support published | Product owner |
| Quality | Held-out evaluation and performance report meet declared gates | QA owner |
| Security | Threat review, permission audit, secret scan, dependency/license review | Security owner |
| Privacy | Consent flow, inventory, retention/deletion tests, public notice, store declarations agree | Privacy owner |
| Accessibility | Keyboard, screen reader, contrast, zoom, and reduced-motion evidence | Design/QA owner |
| Build integrity | Reproducible tagged commit, lockfile, reviewed manifests, artifact hashes | Release owner |
| Store packages | Chrome and Firefox packages tested; signing/reviewer requirements met | Release owner |
| Website | HTTPS, headers, no key collection, working install/support/privacy links | Web owner |
| Operations | Named responder, incident procedure, recovery package exercise | Release owner |

Roles are responsibilities to assign, not claims that a team already exists. A smaller team may combine roles but must still retain evidence.

## Website deployment

Select a static host and domain, configure HTTPS and security headers, and deploy from a protected main branch/release tag. Preview deployments must use synthetic content and no provider secrets. Keep immutable artifacts and an explicit previous deployment for rollback. Verify canonical URLs, metadata, robots behavior for previews, link integrity, and custom error pages.

No account/billing service is needed for v1. Disclose any host logs and cookies actually used. Start without marketing trackers; adding analytics changes the privacy review. Website install buttons point to verified store listings only after approval.

## Extension release and recovery

Use semantic versions for packages and independent schema/prompt/taxonomy versions. Build once from a tagged commit, inspect both manifests, sign through the applicable store process, and retain the exact artifacts and hashes. Test update from the previous supported version, not just fresh install. Release notes describe changed permissions, classification behavior, and known limitations.

Use beta channels or controlled distribution where supported and permitted, then expand after evidence. Store updates are not instantaneous. Recovery usually means publishing a new higher-version package containing reverted code; do not assume stores allow downgrading installed extensions. Migrations must tolerate the supported recovery path.

No remote-code or selector hot-patch mechanism is included. The immediate user mitigation is Pause/disable; a broken extractor must also fail open locally. A future remote disable-only feature would require a separate privacy and integrity design.
