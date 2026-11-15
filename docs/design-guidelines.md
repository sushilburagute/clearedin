# Design guidelines

## Product character

Calm, readable, and practical. Lead with “Your feed, your choices.” Explain concrete controls without shaming authors. Use “Generic motivational stories” or “Engagement bait” in the interface rather than a universal “slop score.” Avoid claims about whether an author used AI.

## Visual foundation

Proposed tokens: canvas `#F7F8FA`, surface `#FFFFFF`, text `#17212B`, muted text `#52606D`, accent `#0F766E`, border `#D6DCE2`, warning text `#92400E`, error text `#B42318`. Test actual foreground/background pairs; these tokens alone do not establish accessibility compliance.

Use a system sans-serif stack, 16px website body text, at least 14px extension body text, and approximately 1.5 line height. Use a 4/8/12/16/24/32/48px spacing scale, 8px control corners, visible focus rings, and restrained shadows. Color never carries state alone. Support system light/dark preferences with independently checked contrast. Bundle fonts/icons locally if needed.

Keep website text columns near 65–75 characters. Use ordinary headings and simple sections; avoid dense dashboard chrome. Popup target width is approximately 360px, tested at 200% zoom and within each browser's popup constraints. Complex forms live in the full options page.

## Surfaces and flows

**Website:** Home → How it works → Synthetic demo → Install → Provider setup → Privacy → FAQ/support → Changelog. The demo runs on fixed fixtures with no API key and labels its sample results. Show separate Chrome and Firefox installation states. Before store approval, use honest “Coming soon” labels rather than inactive install buttons disguised as working links.

**Onboarding:** Explain the feature and data flow → select provider/model → grant the provider host permission → enter credential in an extension-owned page → run a synthetic connection test → choose category rules → explicitly consent and enable. Consent describes recipient, post text, purpose, and provider retention link. Declining leaves the feed untouched and settings accessible. Do not accept credentials on the public website.

**Popup:** Active/paused status, current provider, session hide count, daily requests remaining, Pause/Resume, and Open settings. On unsupported pages show “Filtering runs on the LinkedIn home feed.” Distinguish “No posts classified yet” from a broken extractor.

**Options:** Categories, provider and model, privacy/consent, limits, data management, diagnostics. Each category has a short definition and a three-state control: Show normally / Hide / Always show. Explain that Show normally does not protect against another hidden category; Always show does.

**Hidden post:** Compact placeholder in the post's position: “Hidden: Engagement bait · Show.” Details contain matched categories and the configured rule. Show reveals immediately. “Keep this post visible” lasts for this page session; a separate category control changes future behavior. Do not imply a one-off reveal retrains the model.

## Required states and behavior

| State | User-facing behavior |
| --- | --- |
| Pending classification | Original post remains visible; avoid noisy per-post spinners. |
| Hidden | Accessible placeholder and reveal control. |
| Low confidence, insufficient text, unsupported language | Keep visible; optional detail says why no filtering occurred. |
| Invalid credential | Keep visible; popup offers Update key. |
| Rate limit or daily cap | Keep visible; show reset/retry information without repeated toasts. |
| Offline or provider unavailable | Keep visible; status names the issue without claiming an empty feed. |
| Consent withdrawn or paused | Restore hidden content; stop new requests; discard late results. |
| Provider change | Explain new recipient and require consent before transmission. |
| Extractor unhealthy | Restore affected content and show a compatibility notice. |

Never collapse a post while keyboard focus is within it; defer until focus leaves. Preserve focus on reveal and use one restrained polite live region for user-triggered changes, not every classification. Pause and restore must clean up styles and placeholder nodes.

## Accessibility and responsive behavior

Target WCAG 2.2 AA: keyboard operation, semantic labels, visible focus, contrast verification, text resizing, reduced motion, and screen-reader checks. Aim for 44px touch targets where feasible and meet applicable AA target-size requirements. Settings must work without drag gestures, hover, or color perception. A segmented control must expose one selected value to assistive technology.

Isolate injected UI styles, preferably with Shadow DOM, while explicitly testing focus, accessible naming, and the host post's hidden state. Use the `hidden` attribute or equivalent for hidden content so its links are not accidentally tabbable. Do not remove host nodes from LinkedIn's ownership. Restore the exact previous attributes/styles, including on disable or route changes.

Website checks cover 360px, 768px, and 1440px widths, keyboard navigation, zoom, and reduced motion. Product screenshots must contain synthetic content and no real credentials or private posts.
