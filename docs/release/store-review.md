# Store reviewer notes for the desktop development preview

ClearedIn Development lets the installing user filter organic posts on the desktop LinkedIn home feed. In extension settings, select a provider, grant the browser permission, save a session key, test with a synthetic post, select category rules, then consent and enable. The separate setup simulation works without an account or key. The product run on a synthetic feed exercises the real package with an offline provider. [Chrome walkthrough](../../experiments/browser-feasibility/evidence/chrome-feed-onboarding.md)

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
| Short description | Choose which organic LinkedIn home-feed posts to collapse, using your own provider key and category rules. |
| Storage permission | Stores preferences, consent and request counts locally. The selected provider key is held in privileged browser-session storage. Disconnect forgets the key. Clear all data resets local state. |
| LinkedIn match | Only the top-frame desktop home feed at `www.linkedin.com/feed` or `/feed/`, including query variants, matches. Activated filters classify selected rendered post text. Recognized sponsored posts are excluded. Users can reveal collapsed posts or pause filtering. |
| Optional host permissions | The user grants access to their selected API origin for TypeSafe Jev, OpenAI or Anthropic. A fixed synthetic request tests that connection. Remote classification can incur charges on the user's account. |
| Remote code and data | Code ships inside the ZIP. The CSP restricts API connections to the three provider origins and blocks remote scripts, objects and form submissions. Firefox declares optional `authenticationInfo` and `websiteContent` with no required data collection. Processing feed text requires an additional in-extension consent and enable action. The website has separate data practices. |
| Contact and policy | The project lists support@sush.dev and publishes its [support page](https://clearedin.sush.dev/support/) and [privacy page](https://clearedin.sush.dev/privacy/). Verify these against the authorized release and publisher disclosures. |
| Artwork | Use the [128 px icon](../../apps/extension/public/icon/128.png) and [1280 × 800 options screenshot](assets/options-1280x800.png). Suggested caption — “Category preferences saved locally in the development preview.” The image shows default rules in a disposable profile. |

The publisher selects the public identity, license, final listing, distribution platforms and production extension IDs. Recheck disclosure text and screenshots if functionality changes. [Chrome listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) · [Chrome privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) · [AMO submission fields](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)

## Mozilla validation

`pnpm release:amo` runs Mozilla's **addons-linter 10.16.0** locally against the inventoried Firefox ZIP after checking its digest. It writes the complete JSON result, validator version and package hash to `.release/amo-validation.json`. The validator and its dependencies have a separate frozen lockfile and install with lifecycle scripts disabled. The measured Windows install resolved 185 packages for validation. An ordinary developer or reviewer build installs none of these additional packages. [Mozilla validator](https://github.com/mozilla/addons-linter)

The Windows validation of the home-feed build recorded **0 errors, 0 notices and 6 warnings**. CI fails on errors or warnings outside the reviewed files, codes and counts. Review the source locations for each candidate.

| Count | Finding | Review disposition |
| --- | --- | --- |
| 1 | Android minimum version | Desktop Firefox 140 supports the declared data-consent key. Android support starts at 142. Desktop is the tested target. Android needs its own minimum version decision and device testing before selection. [Mozilla compatibility](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/) |
| 3 | `DANGEROUS_EVAL` in the background, feed content script and shared UI | All three point to Zod's empty-string `Function` capability probe. The [extension build entry](../../apps/extension/build/zod-csp.ts) configures the interpreted parser before schema construction. Zod skips the probe when `jitless` is set. Static scanning still sees the library branch. |
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
