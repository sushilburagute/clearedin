# Release and recovery

ClearedIn is a development preview. The [release ledger](gates.json) records the status, accountable role, reason, and evidence for each launch decision. Public distribution requires a written platform decision, accepted provider and credential handling, quality and accessibility evidence, and named privacy, release, and incident owners. Verify policies on the submission date. [LinkedIn](https://www.linkedin.com/help/linkedin/answer/a1341387) · [Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) · [Mozilla Add-ons](https://extensionworkshop.com/documentation/publish/add-on-policies/)

## Prepare a review bundle

Start from the reviewed source and frozen lockfile. Run the [development checks](../../README.md#commands), including the integration build and site checks. Then run:

```sh
pnpm package:chrome
pnpm package:firefox
pnpm artifacts:check
pnpm release:prepare
pnpm release:check
```

The browser archives are under `apps/extension/.output/`. The static site is in `apps/website/dist/`. Artifact checks compare each browser ZIP with the inspected build. The WXT Firefox sources ZIP covers the extension only. Use `.release/repository-source.zip` for a full monorepo rebuild.

`.release/inventory.json` records SHA-256 hashes, source commit, dirty state, and Node version. Release preparation needs a Git checkout. The archived source can be built without Git. Before submission, reproduce the packages independently from a clean tag and retain both inventories. The gate checker exits 2 while a decision is pending or failed.

## Reviewer walkthrough

1. Inspect both manifests for storage permission, the feed-scoped inert content script, local-code CSP, and absence of provider host access.
2. In disposable profiles, verify local save, reopen, and reset. Run the [settings smoke checks](../testing-and-evaluation.md#browser-checks). Open and exit the synthetic setup demo and confirm that real preferences are intact.
3. Exercise hide, protect, reveal, pause, and reset on the synthetic website. Use the [accessibility protocol](../../tests/accessibility/README.md) for keyboard, screen-reader, zoom, dark mode, and forced-color checks.
4. Confirm the package’s actual network behavior and permissions match its privacy disclosure. Use synthetic content in reviewer screenshots. Record browser versions, artifact hashes, results, and known limitations.

## Deployment and incidents

Publish only the reviewed static build when the host, domain, support contact, and listings are approved. Apply `apps/website/public/_headers` or equivalent host settings, then check HTTPS, CSP, links, and preview noindex on the deployed site. Retain the previous static artifact for rollback.

| Incident | Immediate action and recovery |
| --- | --- |
| Incorrect hides, broken markup, or migration failure | Pause or disable filtering. Reproduce on synthetic markup or an old settings fixture. Ship a reviewed higher-version recovery package with compatible migrations and test the upgrade. |
| Suspected key exposure or unintended transmission | Pause rollout and requests. Revoke the key at its issuer, remove the local credential, identify affected builds, and verify remediation before using a replacement. |
| Provider outage or unexpected spending | Keep posts visible, inspect reservation counts and provider billing, and check rate limits and pricing. Resume only within the existing consent and budget. |
| Website regression | Restore the previous immutable build and verify the deployed headers and links. |

Collect versions, sanitized error codes, impact, and synthetic reproduction steps. Keep keys, private posts, cookies, and unredacted screenshots out of support reports. Assign a responder and backup and record the fix and verified recovery in the release record.
