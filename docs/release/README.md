# Release and recovery

ClearedIn is a development preview. The [release ledger](gates.json) records the status, accountable role, reason, and evidence for each launch decision. Public distribution requires a written platform decision, accepted provider and credential handling, quality and accessibility evidence, and named privacy, release, and incident owners. Verify policies on the submission date. [LinkedIn](https://www.linkedin.com/help/linkedin/answer/a1341387) · [Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) · [Mozilla Add-ons](https://extensionworkshop.com/documentation/publish/add-on-policies/)

## Prepare a review bundle

Start from a clean Git checkout. Use Node 24.22.3 and pnpm 12.4.1. Run the [development checks](../../README.md#commands), including the integration build and site checks. Prepare and verify the bundle from the repository root.

```sh
pnpm package:chrome
pnpm package:firefox
pnpm artifacts:check
pnpm release:prepare
pnpm release:verify
pnpm release:amo
pnpm release:check
```

The browser archives are under `apps/extension/.output/`. The static site is in `apps/website/dist/`. Artifact checks compare each browser ZIP with the inspected build. Release preparation archives every tracked file at the recorded commit, including the workspace packages, lockfiles, dotfiles and build instructions. WXT's extension-only source ZIP is disabled.

`.release/inventory.json` identifies the commit and gives SHA-256 hashes for the archives and source files. The verifier extracts the source ZIP to a fresh temporary directory, installs its frozen dependencies, builds both targets, and requires the delivered and rebuilt ZIPs to match byte for byte. CI retains the inventory, rebuild results and Mozilla validator report with the development bundle. The gate checker exits 2 while a decision is pending or failed. An accepted tag and release-owner signoff are still outstanding.

Reviewers building directly from the source ZIP can use the commands, asset files and privacy explanations in the [store reviewer notes](store-review.md).

## Reviewer walkthrough

1. Inspect both manifests for storage permission, exact desktop home-feed matches, local-code CSP, and optional origins limited to the three pinned providers. Check the Firefox declarations for optional authentication and website content.
2. In disposable profiles, verify local save, reopen, and reset. Run the [settings smoke checks](../testing-and-evaluation.md#browser-checks). Open and exit the synthetic setup demo and confirm that real preferences are intact.
3. Exercise hide, protect, reveal, pause, and reset on the synthetic website. Use the [accessibility protocol](../../tests/accessibility/README.md) for keyboard, screen-reader, zoom, dark mode, and forced-color checks.
4. Confirm the package’s actual network behavior and permissions match its privacy disclosure. Use synthetic content in reviewer screenshots. Record browser versions, artifact hashes, results, and known limitations.

## Deployment and incidents

Vercel hosts the public demo at [clearedin.sush.dev](https://clearedin.sush.dev/). Check HTTPS, CSP, links, and support contacts on a review deployment before promoting it. Verify that the production pages allow indexing and review deployments carry `noindex`. Vercel applies the headers in `apps/website/vercel.json`. For other hosts, apply `apps/website/public/_headers` or equivalent host settings. Retain the previous static artifact for rollback. Publish extension install links once the respective listings are approved.

| Incident | Immediate action and recovery |
| --- | --- |
| Incorrect hides, broken markup, or migration failure | Pause or disable filtering. Reproduce on synthetic markup or an old settings fixture. Ship a reviewed higher-version recovery package with compatible migrations and test the upgrade. |
| Suspected key exposure or unintended transmission | Pause rollout and requests. Revoke the key at its issuer, remove the local credential, identify affected builds, and verify remediation before using a replacement. |
| Provider outage or unexpected spending | Keep posts visible, inspect reservation counts and provider billing, and check rate limits and pricing. Resume only within the existing consent and budget. |
| Website regression | Restore the previous immutable build and verify the deployed headers and links. |

Collect versions, sanitized error codes, impact, and synthetic reproduction steps. Keep keys, private posts, cookies, and unredacted screenshots out of support reports. Assign a responder and backup and record the fix and verified recovery in the release record.
