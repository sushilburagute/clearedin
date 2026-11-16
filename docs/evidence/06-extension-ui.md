# Task 06 extension UI handoff

Status: **UI components implemented against frozen injected clients and explicit mocks**. Production messaging, live provider/browser support, and manual accessibility evidence remain pending. Date: 2026-11-16. Baseline: `14348e8` on `main`; branch: `feat/feed-adapter-extension-ui`, isolated worktree `.worktrees/feed-adapter-extension-ui`. The prerequisite foundation, policy and storage handoffs are present; task 02's production credential gates are unchanged.

## Files and stable exports

- `packages/ui/src/{tokens,controls,catalog,controller,surfaces,demo,index}.{ts,tsx}` and `styles.css` provide the shared UI. `@clearedin/ui` exports `UI_TOKENS`, `Button`, `Notice`, `CategoryControl`, `OptionsSurface`, `PopupSurface`, `createOptionsController`, `createPopupController`, `ERROR_COPY`, `statusCopy`, `resetCopy`, and types including `UiEnvironment`, `UiSnapshot`, `ProviderChoice`, and both controllers. `@clearedin/ui/styles.css` exports stable `--ci-*` tokens, with light/dark themes. CSS is marked as a package side effect so consumers retain it.
- `createUnavailableClient`, `UNAVAILABLE_ENVIRONMENT`, `UNAVAILABLE_PROVIDERS`, and `createDemoSession` provide clearly named development/mock seams. The demo is an `OptionsClient` simulation, never a classifier/provider adapter. It has no networking, persistence, real permission requests, or credential storage; it rejects credential commands, uses only `SYNTHETIC-UI-ONLY` models, and discards state on exit.
- `apps/extension/entrypoints/{popup,options}/main.tsx` mount `apps/extension/src/ui/bootstrap.tsx`. Both packaged entrypoints default to unavailable transport. Options offers an explicit “Explore synthetic UI demo” switch with a persistent warning and disabled credential entry. The popup can open the packaged settings page. Background/content entrypoints and production manifest permissions remain inert and unchanged.
- `packages/ui/tests/{controller,surfaces,contrast}.test.ts` contain 28 tests. Coordinated dependency changes add workspace UI to the extension, taxonomy/React to UI, existing pinned React types/rendering and `linkedom@0.18.15` to UI tests. No schema, IPC command, policy, credential store, provider implementation, or settings migration is redefined.

## UI behavior and transport expectations

The options controller consumes the frozen `OptionsClient`; the popup consumes only `PopupClient`. Replies are strictly parsed and request-correlated. Broadcasts are schema-checked. Public status carries booleans/configuration/counts only. Transport errors map to fixed local copy, with no raw upstream bodies or exception messages rendered. Test results are provider/model correlated and invalidated on provider/reset/credential/consent-withdrawal changes. Pending reads cannot overwrite newer broadcasts, and routine usage broadcasts do not invalidate tests or reset editing forms. Disposal releases subscriptions and ignores late replies.

Task 11 supplies a verified `ProviderChoice` catalog (available models, recipient, retention URL, and permission description) and `UiEnvironment` capability functions. All shipped provider choices are unavailable until then. There is no caller-specified endpoint or arbitrary model input. `requestPermission` invokes the injected permission function immediately from the button's user gesture. The controller does not implement browser permission policy or credential custody.

Onboarding selects provider/model, separately grants host access, sends a masked session credential only through `SET_CREDENTIAL`, requests the broker's fixed synthetic connection test, selects rules/limits, explicitly records disclosure consent, then enables. Provider changes invalidate consent and the prior test. Credential input is uncontrolled and immediately cleared before dispatch; it is absent from snapshots, returned settings, status, notices and diagnostics. Demo/default builds cannot accept it. Consent describes recipient, text/instructions, classification purpose, provider retention, billing, and withdrawal. Declining keeps filtering disabled.

Each category has a labeled native three-state select, definition, and neutral/protection explanation. Defaults come from the frozen settings contract and begin neutral. Limits cover daily requests and optional currency/estimated-cost caps; copy explains conservative accounting, unavailable estimates, and that an estimate is not a provider-enforced spend guarantee. Options supports pause/enable, withdrawal, disconnect, explicit local clear, and strict sanitized diagnostic preview. Local clear retains only the broker's documented non-secret generation marker. Nothing is sent to support or downloaded automatically.

Popup status includes active/paused state, provider/model, session hide count, daily requests remaining, reset time with its actual zone, Pause/Resume, and settings. It never reads settings or credentials. Error copy covers unsupported routes, authentication, permissions, unavailable/offline operation, quotas, timeouts, invalid responses, and storage/version failures. Retry delay/reset information is displayed when supplied. The frozen public status has no active-tab route/permission field; the popup always states that filtering runs on the LinkedIn home feed and uses `unsupported_route` when the broker supplies it. Task 11 owns that route/status decision and sender authorization.

## Accessibility evidence

The UI uses native buttons, forms, selects, labeled inputs, headings, status/error semantics, visible focus outlines, 44 px primary controls, responsive category layouts, and reduced-motion rules. It uses a locally bundled system font stack and no remote assets. Light/dark contrast tests verify body, muted, warning, error and link text at least 4.5:1, accent-button text at least 4.5:1, and input boundaries at least 3:1 against both canvas and surface. CSS and exported token colors are checked together.

Rendered React interaction tests verify labeled category controls, unchecked/disabled consent until setup, provider form submission, separate permission activation, synthetic test state, masked credential clearing before broker dispatch, sanitized credential-error handling, unavailable defaults, and popup settings navigation/capability separation. `linkedom` lacks native form reset/collection APIs, so those two behaviors are explicitly modeled in the harness. Controller tests cover neutral defaults, test/consent enablement gates, changes/reset/disconnect, request validation, external reset versus late test, normal broadcasts during onboarding, diagnostics rejection, lifecycle cleanup, and late popup reads.

These are semantic/interaction/contrast checks, **not manual keyboard, native layout, screen-reader, 200% zoom, forced-colors, or packaged-browser validation**. Those checks remain pending. No live provider, real key, host-permission prompt, or LinkedIn content was used.

## Repository validation

Checks run in the isolated worktree on Windows with Node 24.22.3 and pnpm 12.4.1 (the pinned Node directory was prepended to the command process PATH):

| Command | Actual result |
| --- | --- |
| `pnpm install --offline --frozen-lockfile` | Pass; locked dependencies installed from cache |
| `pnpm exec vitest run packages/linkedin-adapter/tests packages/ui/tests` | Pass: 53 component tests |
| `pnpm lint` | Pass, including dependency boundaries |
| `pnpm format:check` | Pass |
| `pnpm typecheck` | Pass: shared packages, extension and Astro; zero diagnostics |
| `pnpm test` | Pass: 210 Vitest cases plus 12 Node boundary checks, 222 total |
| `pnpm docs:check` | Pass: local links and code fences |
| `pnpm build` | Pass: website and Chrome/Firefox MV3 extension outputs |
| `pnpm package:chrome` / `pnpm package:firefox` | Pass: development ZIPs generated |
| `pnpm artifacts:check` | Pass: manifests, local code/basic secret patterns, ZIP/build byte parity |
| `node scripts/integration-status.mjs` | Expected NOT IMPLEMENTED, exit 2; packaged integration remains unavailable |
| Hosted CI / manual browser/accessibility / live provider checks | Not run locally; no pass claimed |

The committed tests are reproducible evidence. Generated outputs/ZIPs are ignored. Build/packaging success does not establish provider feasibility, credential isolation, native accessibility, or live filtering. No publication, deployment, signing, or store submission occurred.

## Next integration actions

Task 10 can consume shared tokens/controls without importing provider/storage execution. Task 11 replaces unavailable clients and supplies the verified capability/catalog configuration, sender allowlists, status broadcasts, broker-only credentials, privacy/permission decisions, and actual reset/cancellation operations. It must preserve popup/options privilege separation and refuse unsupported providers even if a caller bypasses the UI. The UI's gates supplement broker enforcement; they do not authorize networking.

Keep the mock visibly synthetic and credential-disabled. Complete packaged Chrome/Firefox keyboard/zoom/screen-reader and permission checks with the real client, connect the [DOM adapter](05-feed-dom-adapter.md), and close task 02/provider feasibility gates before production enablement. No production runtime is enabled by this component handoff.
