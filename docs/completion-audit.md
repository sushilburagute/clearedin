# Verification record

## November 21 opt-in extension checks

- Chrome 157.0.8103.80 on Windows ran the packaged onboarding and home-feed workflow against offline fixtures. Two organic posts were collapsed, a sponsored post stayed visible, and pausing restored posts in two tabs. The test made one sample request and two classification requests to the loopback provider. [Archive hash, observations and reproduction steps](../experiments/browser-feasibility/evidence/chrome-feed-onboarding.md)
- Firefox 160.0.1 on Windows ran two disposable-profile tests against the temporary ZIP with SHA-256 `989be92b386c7fd246084ca088041a4385d35e8b9c3c896ded4272f525db6b74`. The native dialog presented the selected provider origin, authentication information and website content permissions. Denial kept key entry disabled. After granting access and saving a dummy key, revoking either the host or the website-content permission cleared the key and disabled entry. Both profiles entered and exited the synthetic setup demo. The network observer recorded zero attempts to contact LinkedIn or a provider.
- Both browsers saved a category change, retained it when reopening options and restored the defaults after confirmed reset. Live LinkedIn markup, paid provider responses and signed Firefox installation across a browser restart still need verification. [Release ledger](release/gates.json)

## November 20 development audit

| Area | Verified in the development build |
| --- | --- |
| Repository | 282 package/evaluation tests, 19 script tests, and 57 integration tests passed. One opt-in live provider test was skipped. Lint, formatting, types, nine static pages, and browser ZIP/build parity passed. |
| Extension settings | Chrome 157.0.8103.80 and Firefox 160.0.1 on Windows saved a category rule, retained it after reopening options, and restored defaults after a confirmed reset. Credential entry stayed disabled. |
| Website | Headless Chrome checked the homepage and demo at 320, 360, 768, and 1440 CSS pixels using the packaged content security policy. Keyboard reveal restored focus. Dark mode was checked at 768 pixels and reduced motion at all four widths. |
| Demo size | Computing the fixed outcomes at build time reduced uncompressed client JavaScript from 105,026 to 1,402 bytes. The demo covers 12 categories with 14 synthetic posts. |
| Storage timing | With 200 synthetic ledger entries, five warmups, and 50 measured reads per version, reusing the timezone formatter reduced median public-status read time from 12.1 ms to 1.3 ms in Node. |
| Feed behavior | Synthetic integration tests cover recycled posts, stale replies, same-generation preference changes, cancellation, placeholder tracking, and restoration on pause. |

The earlier browser probe tested session isolation and background termination with a dummy credential. Persistent-install restart and interactive permission grant, denial, and revocation still need evidence. [Chrome probe results](../experiments/browser-feasibility/evidence/chrome-windows.json) · [Firefox probe results](../experiments/browser-feasibility/evidence/firefox-windows.json)

Live-feed compatibility, accepted provider configurations, independently calibrated thresholds, manual accessibility acceptance, and long-running packaged performance remain open. Track owners and decisions in the [release ledger](release/gates.json). Use the [test guide](testing-and-evaluation.md) to reproduce checks.
