# Packaged accessibility validation protocol

State: pending; this protocol is not execution evidence.

Record source SHA, package checksum, OS/browser and assistive-technology version for each run. Required matrix: Chrome stable/previous and Firefox stable/ESR on Windows/macOS, plus supported Linux smoke. Record unsupported combinations explicitly.

For extension onboarding, popup, settings and website at 320, 375, 768, 1024 and 1440 CSS pixels:

1. Use keyboard only to consent, change all category modes, pause/resume and reveal a post. Verify visible focus, labels, logical order and no traps.
2. Focus a link within a post when a hide result arrives. Confirm focus is preserved and the post is not collapsed around focused content. Reveal via keyboard and confirm exact restoration.
3. With a screen reader, inspect placeholder name/reason and button semantics; ensure status updates are understandable without repetitive announcements.
4. Test 200% zoom, forced colors and reduced motion, and check contrast and target sizes. Confirm controls and text remain usable without horizontal loss of content.
5. Run an automated accessibility scan on every page/state, retain its output, and manually review what it cannot establish.

Record pass/fail/pending per item, reproducible steps, expected/actual behavior, severity, component owner and verified-fix commit. Never label a source inspection or unit test as a packaged screen-reader pass.
