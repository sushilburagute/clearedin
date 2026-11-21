# Store reviewer notes for the desktop development preview

**Package purpose.** ClearedIn Development lets users configure category rules in browser-local settings and try them in a synthetic setup demo. Live feed filtering and provider connections are unavailable in version 0.1.0. The reviewer walkthrough works in a fresh profile without accounts, sample posts or API keys.

## Rebuild the submitted ZIPs

Extract `repository-source.zip` into an empty directory. From its root, use Node **24.22.3** and pnpm **12.4.1** on a desktop with npm registry access. The Windows verification used x64. CI runs these steps on Ubuntu. Install the pinned Node version using your usual Node version manager or the [Node distribution](https://nodejs.org/dist/v24.22.3/).

```sh
npm install --global pnpm@12.4.1
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm package:chrome
pnpm package:firefox
```

Compare the SHA-256 of each resulting `apps/extension/.output/clearedinextension-0.1.0-{chrome,firefox}.zip` with the same filename in the supplied `inventory.json`. On Linux use `sha256sum apps/extension/.output/*.zip`. In PowerShell use `Get-FileHash apps/extension/.output/*.zip`. The production bundles contain minified WXT/Vite output, React DOM and Zod. The source archive includes their pinned dependency graph and all local workspace inputs. The rebuild requires neither Git history nor publisher credentials. [Mozilla source submission instructions](https://extensionworkshop.com/documentation/publish/source-code-submission/)

## Listing and disclosure inputs

| Field | Evidence for this preview |
| --- | --- |
| Store packages | Use the browser-specific ZIP identified in the inventory. AMO also needs `repository-source.zip` and the build instructions above. Select desktop platforms when evaluating this build. |
| Short description | Save category rules locally and explore a synthetic setup demo. Live filtering is unavailable in this development preview. |
| Storage permission | Retains preferences such as category choices and usage limits within the browser profile. In settings, confirm Clear all data and reopen to see the defaults. |
| LinkedIn match | The manifest registers an empty application content-script entry point at `https://www.linkedin.com/feed/*`. WXT wraps it with lifecycle code. The preview does not extract posts or modify the feed. Decide whether this match belongs in the final product before justifying any site access to reviewers. |
| Remote code and data | Extension scripts ship in the package. The extension-page CSP limits scripts and objects to self. The preview requests no provider hosts, accepts no real credentials and transmits no posts. Firefox declares `data_collection_permissions.required: ["none"]`. The public website is a separate surface. |
| Contact and policy | The project lists support@sush.dev and publishes its [support page](https://clearedin.sush.dev/support/) and [privacy page](https://clearedin.sush.dev/privacy/). Verify these against the authorized release and publisher disclosures. |
| Artwork | Use the [128 px icon](../../apps/extension/public/icon/128.png) and [1280 × 800 options screenshot](assets/options-1280x800.png). Suggested caption — “Category preferences saved locally in the development preview.” The image shows default rules in a disposable profile. |

The publisher selects the public identity, license, final listing, distribution platforms and production extension IDs. Recheck disclosure text and screenshots if functionality changes. [Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) · [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) · [AMO submission fields](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)

## Mozilla validation

`pnpm release:amo` runs Mozilla's **addons-linter 10.16.0** locally against the inventoried Firefox ZIP after checking its digest. It writes the complete JSON result, validator version and package hash to `.release/amo-validation.json`. The validator and its dependencies have a separate frozen lockfile and install with lifecycle scripts disabled. The measured Windows install resolved 185 packages for validation. An ordinary developer or reviewer build installs none of these additional packages. [Mozilla validator](https://github.com/mozilla/addons-linter)

The Windows run recorded **0 errors, 0 notices and 5 warnings**. CI fails on validator errors or warning codes, bundle names or counts outside the reviewed set. Review source locations again for each candidate, even when counts match.

| Count | Finding | Review disposition |
| --- | --- | --- |
| 1 | Android minimum version | Desktop Firefox 140 supports the declared data-consent key. Android support starts at 142. Desktop is the tested target. Android needs its own minimum version decision and device testing before selection. [Mozilla compatibility](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) |
| 2 | `DANGEROUS_EVAL` in background and shared UI | Both point to Zod's empty-string `Function` capability probe. The [extension build entry](../../apps/extension/build/zod-csp.ts) configures Zod's interpreted parser before the application constructs its schemas. Zod skips the probe when `jitless` is set. Static scanning still sees the library branch. |
| 2 | `UNSAFE_VAR_ASSIGNMENT` in shared UI | Both point to React DOM's implementation of `dangerouslySetInnerHTML`. The extension and shared UI do not supply that prop. Check again when changing React or the rendering paths. |

AMO performs its own validation and review after an authorized upload.

## Exercise a higher-version recovery

After packaging, run each command from the repository root. Supply a browser executable after its name if needed.

```sh
node experiments/browser-feasibility/browser-runner.mjs chrome --upgrade
node experiments/browser-feasibility/browser-runner.mjs firefox --upgrade
node experiments/browser-feasibility/browser-runner.mjs chrome --settings --store-screenshot
```

The upgrade exercise starts with the audited ZIP and saves a non-default rule through the options page. It increments only the manifest version in a disposable copy, checks the running version under the original ID, reopens the saved rule, then resets and reopens defaults. Chrome reloads the same unpacked path. Firefox replaces a temporary add-on. The fixture is deleted afterward. The screenshot command captures the reset category controls in `experiments/browser-feasibility/results/options-1280x800.png`.

On Windows, Chrome 157.0.8103.80 and Firefox 160.0.1 both retained the rule across **0.1.0 → 0.1.1** and passed reset. The records include each baseline ZIP digest. This exercises local storage continuity for the existing schema. Store delivery, persistent signed-install restart and future migrations require evidence on the production identity and actual recovery build. [Chrome run](../../experiments/browser-feasibility/evidence/chrome-upgrade.json) · [Firefox run](../../experiments/browser-feasibility/evidence/firefox-upgrade.json)
