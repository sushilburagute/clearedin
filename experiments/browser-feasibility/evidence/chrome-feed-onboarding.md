# Packaged Chrome home-feed smoke

On November 21, 2026, Chrome 157.0.8103.80 on Windows completed onboarding, category filtering, individual reveal, caching and cross-tab pause on an offline synthetic feed. The unpacked installation came directly from the 0.1.0 Chrome ZIP, SHA-256 `b99b89bf6a03b0b4743f97e36a860a4657bc14f426f2dc5dbe344be9e83959ca`. Its extension CSP restricted connections to the three configured API origins.

## Reproduce

1. Build with `pnpm package:chrome`, record the archive SHA-256, extract it and use Chrome DevTools Protocol `Extensions.loadUnpacked` in a new headless profile with `--enable-unsafe-extension-debugging` and `--remote-debugging-port=0`.
2. Serve two HTTPS fixtures on one ephemeral loopback port. Start Chrome with host resolver rules mapping `www.linkedin.com` and `api.typesafe.ai` to that port and all other hostnames to `~NOTFOUND`. Disable proxies, QUIC and background networking. Trust the fixture certificate in this disposable profile.
3. For the home page at `/feed/`, serve a `main` with a `[role=feed]` containing three visible `article.feed-shared-update-v2` elements with distinct `data-urn` activity IDs. Give each article a `.update-components-text` child with one of the texts below. In the third article include a visible `.update-components-actor__sub-description` containing `Sponsored`.
4. For Jev's `POST /v1/systemone`, check the synthetic Bearer credential, absence of cookies, and record `state.post_text`. Respond with the requested model, one `{type: "noul", noul: score}` answer per requested question, and integer input/output token counts. Use 0.99 for `technical_content` and `sufficiency`, and 0.01 for the others.
5. Load the feed before onboarding. In extension options, select TypeSafe Jev and its listed model. For this headless test, preauthorize `https://api.typesafe.ai/*` through the disposable profile's extension-management API, then click **Grant provider host access** in the product UI. Save a dummy session key and run the synthetic connection test. Set **Technical blogs and projects** to **Hide** and save. Record consent, enable filtering and activate the feed tab so its viewport observers run.
6. Reveal one placeholder, activate a second tab with the same feed, then pause in extension options. Check visibility and placeholder removal in both tabs. Close the test profile and fixture server.

| Observation     | Actual result                                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before enabling | One fixed synthetic connection test reached the loopback API. No feed text was sent.                                                                            |
| First tab       | “Designing a synthetic compiler” and “Testing a synthetic parser” were sent and hidden. “Buy a synthetic tool” had the Sponsored disclosure and stayed visible. |
| Reveal          | One organic article returned. The other remained hidden.                                                                                                        |
| Second tab      | Both organic articles were hidden using cached decisions. The API request count stayed at three.                                                                |
| Pause           | All three articles were visible and all extension placeholders were gone in both tabs.                                                                          |

This run used the shipped Chrome code and a simulated LinkedIn page, provider response, and optional-host approval. Live LinkedIn markup, real provider credentials and responses, classification accuracy, and the native permission prompt still need independent verification.
