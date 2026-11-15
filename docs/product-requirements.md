# Product requirements

## Outcome and audience

Help professionals, job seekers, and builders spend less attention on unwanted LinkedIn posts without losing useful opportunities or technical content. “Slop” is a user preference, not an objective property of an author. The product filters posts, does not rank people, and does not claim to detect whether text was AI-generated.

Primary outcome: users can express what they want to see, understand each hide decision, and reverse it immediately. Reliability means minimizing unwanted hiding before maximizing the number of removed posts.

## Version 1 scope

- Desktop LinkedIn home feed at `https://www.linkedin.com/feed/` and its feed subpaths, with route checks before extraction.
- Chrome and Firefox extension builds from a shared codebase.
- User-selected TypeSafe Jev, OpenAI, or Anthropic adapter with the user's own credential and a tested model selection.
- Text-only post classification, including visible quoted/reposted text where the adapter can distinguish it reliably.
- Built-in categories and per-category **Show normally**, **Hide**, and **Always show** controls.
- Reversible hidden-post placeholders, per-post reveal, pause/resume, and clear local data.
- Explicit transmission consent, provider configuration, usage estimates, request limits, and actionable errors.
- Static public website: explanation, synthetic demo, install links, setup, privacy, FAQ, support, and changelog.
- English classification quality is the first supported baseline. Detect insufficient or unsupported language coverage and leave those posts visible until evaluation supports expansion.

## Core user stories and acceptance criteria

| Story | Acceptance criterion |
| --- | --- |
| I want useful job opportunities without generic stories. | I can set Job postings to Always show and Generic motivational stories to Hide; a post matching both remains visible. |
| I want control over my own provider and cost. | I select a provider and model, see what will be sent, run a synthetic connection test, and set a daily request limit before filtering starts. |
| I want to recover a hidden post. | Every hidden post has a keyboard-accessible Show action; revealing it survives rescans while that post instance remains on the page. |
| I want to understand filtering. | A placeholder names the matched hidden category; details identify the provider/model and explain that the result can be wrong. |
| I want to stop instantly. | Pause restores all extension-hidden posts in the active feed within the target defined in testing; no new remote requests start. |
| I want preferences to apply immediately. | Changing a rule re-evaluates cached classifications without another paid call. |
| I do not want broken APIs to break my feed. | Missing key, timeout, quota, invalid output, and permission loss all leave posts visible and produce a status in the popup. |
| I want private account surfaces excluded. | Messages, profile pages, notifications, search, and the Jobs application are not scanned or transmitted. |
| I want to leave the product. | Disconnect deletes the selected credential; Clear all data removes configuration, consent, cache, and diagnostics, then disables filtering. |

## Product boundaries

No automatic likes, comments, follows, messages, scrolling, link opening, or engagement actions. No LinkedIn login credential access. No background harvesting, comments expansion, media downloads, OCR, video transcription, profile scoring, or inference of sensitive personal traits. No cloud sync, subscription billing, team administration, mobile-browser support, or arbitrary custom categories in v1.

Sponsored/promoted content can be identified through a reliable visible disclosure as a separate category. This is a feed preference, not a promise to block every advertisement. Organic product launches are not automatically advertisements.

Classification uses only the text currently rendered for the post. Truncated text and image-only posts may remain unclassified; the extension does not click “see more” for the user. All category examples and website demos use synthetic or permissioned material.

## Success measures

Track hide precision, false-hide rate, category recall, abstention, classification latency, requests per session, cache effectiveness, and user-reported incorrect hides. Definitions and proposed gates are in [testing](testing-and-evaluation.md). These are measured in controlled evaluations and opt-in beta studies; no browsing analytics are required in production.

Do not advertise “removes all slop,” perfect accuracy, zero API cost, or invisible/private processing. Public copy should say that selected post text is sent to the chosen provider after consent and that users remain in control.
