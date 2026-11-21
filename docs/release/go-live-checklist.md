# ClearedIn go-live checklist

Updated November 21, 2026. The public website already hosts a sample feed. Both browser packages implement the opt-in desktop home-feed workflow on the product branch. The [release ledger](gates.json) tracks the 11 decisions for publishing the extension. [Public demo](https://clearedin.sush.dev/demo/)

## Path A — Announce the website demo

Visitors can try 12 category rules on 14 synthetic posts without installing an extension, opening an account or entering a key.

| Area | Delivered in the PRs | Engineering work before or after promotion |
| --- | --- | --- |
| Demo and performance | Homepage and header lead to the demo. Homepage JavaScript transfer fell from 70.7 KB to 1.65 KB. Median desktop LCP on the local benchmark fell from 1.29 s to 0.77 s. | Verify the hosted candidate on desktop and mobile. Check real-user LCP, INP and CLS once field data is available. |
| Search and sharing | Eight production URLs have sitemap entries, canonicals and social previews. The preview build excludes search crawlers. | Inspect the deployed sitemap, robots directives, response headers, sharing cards and missing-page behavior on the production host. Inspect indexing after Search Console verification. |
| Privacy and accessibility | Analytics requires opt-in. Visitors can withdraw from the footer. Chromium checks covered keyboard navigation and withdrawal across tabs. | Verify deployed network behavior with the approved analytics container. Complete screen-reader, high-contrast and zoom acceptance across supported browsers. |

**You or your designated owner**

- Confirm the public operator, monitored support mailbox, initial markets, analytics configuration and retention, and hosting log access and retention.
- Review the protected Vercel candidate or grant access, approve the announcement and authorize production promotion. Verify the Search Console property for indexing reports.

[Website PR](https://github.com/sushilburagute/clearedin/pull/11) · [Privacy notice](https://clearedin.sush.dev/privacy/)

## Path B — Publish the desktop extension for Chrome and Firefox

The installing user selects a provider, grants permission, enters a browser-session API key, tests the connection with a synthetic example, chooses feed rules and explicitly enables classification. The extension can send eligible post text to that provider. Recognized sponsored posts are skipped. Pause restores collapsed posts. The product owner confirmed authorization for the opt-in home-feed workflow. Confirm the scope of public distribution before submission. [Store reviewer notes](store-review.md) · [Security design](../security-and-privacy.md)

| Area | Delivered in the PRs | Engineering work remaining |
| --- | --- | --- |
| Feed and providers | Packaged Chrome and Firefox exercised the real onboarding and filtering path against offline fixtures. Permission and session-key handling, reveal, cross-tab pause and sponsored-post exclusion have test coverage. | Verify current LinkedIn markup in an authorized account, including sponsored labels in supported locales. Exercise each shipping provider with a restricted key, verify traffic and charges, and record failures and recovery. |
| Quality, performance and accessibility | A 200-post Firefox fixture exposed a queue bug that was fixed. In 20 trials each, p95 reveal was 4 ms and p95 cross-tab pause was 64 ms. | Complete the 30-minute scroll and memory soak, compare both desktop browsers and run screen-reader acceptance. Evaluate at least 500 independently labeled examples with 200 held out against the documented precision, false-hide and recall thresholds. |
| Security and privacy | User keys are held for the browser session. Provider permissions, explicit consent, a restricted connection policy, limits and revocation controls are implemented. Full and production dependency audits reported zero known advisories. | Verify signed-install browser restart, credential clearing, and outbound fields against each approved provider. Recheck dependencies and data declarations on the release candidate. |
| Store packages | Clean-source reproducible ZIPs, a full reviewer source archive, Mozilla validation, icon, screenshot, permission descriptions and reviewer steps are available. Both desktops retained a saved rule in an unsigned upgrade rehearsal. | Apply approved production IDs and version. Finalize listing assets and declarations. Rebuild from the final tag, verify digests and signed install, upgrade and recovery, then submit via authorized accounts. |
| After approval | The public site provides a demo while store listings are pending. | Verify each public listing and install flow, publish its install URL, update the changelog, and monitor store notices and support reports. |

**You or your designated owner**

- Confirm public Chrome and Firefox distribution scope, release markets, provider choices, provider retention disclosures and user-paid usage. Supply a test account or arrange a supervised live smoke test. Keep credentials outside chat.
- Select the public publisher, license and stable Firefox ID. Own or delegate the two publisher accounts and complete identity, agreement, payment and two-factor steps as applicable.
- Arrange independent labeling and human acceptance, approve final privacy and store declarations, name the support and incident owners, and authorize submission. Google and Mozilla review the uploads.

[Quality criteria](../testing-and-evaluation.md) · [Performance results](../../tests/performance/README.md) · [Packaging PR](https://github.com/sushilburagute/clearedin/pull/10) · [Dependency audit PR](https://github.com/sushilburagute/clearedin/pull/9) · [Chrome submission](https://developer.chrome.com/docs/webstore/publish) · [Mozilla submission](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
