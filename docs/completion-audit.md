# Verification record

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
