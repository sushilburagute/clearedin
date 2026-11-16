import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { CATEGORY_DEFINITIONS } from '@clearedin/taxonomy';
import type {
  CategoryModes,
  Preferences,
  ProviderId,
} from '@clearedin/contracts';
import { Button, CategoryControl, Notice } from './controls';
import {
  resetCopy,
  statusCopy,
  type OptionsController,
  type PopupController,
} from './controller';

function Frame({
  children,
  demo = false,
  popup = false,
}: {
  children: ReactNode;
  demo?: boolean;
  popup?: boolean;
}) {
  return (
    <main className={popup ? 'ci-app ci-popup' : 'ci-app ci-options'}>
      <header>
        <p className="ci-wordmark">ClearedIn</p>
        <h1>Your feed, your choices.</h1>
      </header>
      {demo && (
        <aside className="ci-demo" aria-label="Synthetic demo">
          Synthetic UI demo only. Nothing is filtered, stored, or sent to a
          provider. Never enter a real key.
        </aside>
      )}
      {children}
    </main>
  );
}

export function PopupSurface({
  controller,
  openSettings,
  mode = 'connected',
}: {
  controller: PopupController;
  openSettings(): void;
  mode?: 'connected' | 'demo' | 'unavailable';
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    void controller.start();
    return () => controller.dispose();
  }, [controller]);
  const status = state.status;
  return (
    <Frame popup demo={mode === 'demo'}>
      {mode === 'unavailable' && (
        <Notice>
          Development build: filtering and provider connections are not wired
          yet. Open settings to explore the synthetic demo.
        </Notice>
      )}
      {state.loading && <p role="status">Loading extension status…</p>}
      {state.error && <Notice error>{state.error}</Notice>}
      {status && (
        <>
          <h2>{status.enabled ? 'Active' : 'Paused'}</h2>
          <p>{statusCopy(status)}</p>
          <dl className="ci-stats">
            <div>
              <dt>Provider</dt>
              <dd>
                {status.provider ?? 'Not selected'}
                {status.model && ` / ${status.model}`}
              </dd>
            </div>
            <div>
              <dt>Hidden this session</dt>
              <dd>{status.sessionHiddenCount}</dd>
            </div>
            <div>
              <dt>Requests remaining today</dt>
              <dd>
                {Math.max(
                  0,
                  status.dailyRequestLimit - status.dailyRequestsUsed,
                )}{' '}
                of {status.dailyRequestLimit}
              </dd>
            </div>
          </dl>
          {resetCopy(status) && <p className="ci-muted">{resetCopy(status)}</p>}
          {status.error?.retryAfterMs !== undefined && (
            <p>
              Retry after {Math.ceil(status.error.retryAfterMs / 1000)} seconds.
            </p>
          )}
          {status.dailyRequestsUsed === 0 && !status.error && (
            <p>No posts classified yet.</p>
          )}
          <Button
            disabled={
              state.busy ||
              (!status.enabled &&
                (!status.credentialConfigured ||
                  !status.consentGranted ||
                  status.state === 'unavailable'))
            }
            onClick={() => void controller.setEnabled(!status.enabled)}
          >
            {state.busy
              ? 'Updating…'
              : status.enabled
                ? 'Pause filtering'
                : 'Resume filtering'}
          </Button>
        </>
      )}
      <p>Filtering runs on the LinkedIn home feed.</p>
      <Button className="ci-secondary" onClick={openSettings}>
        {status?.error?.code === 'invalid_credential'
          ? 'Update key in settings'
          : 'Open settings'}
      </Button>
      <p role="status" aria-live="polite">
        {state.notice}
      </p>
    </Frame>
  );
}

function PreferencesForm({ controller }: { controller: OptionsController }) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const settings = state.settings;
  const [modes, setModes] = useState<CategoryModes | null>(null);
  const [limit, setLimit] = useState('200');
  const [cap, setCap] = useState('');
  const [currency, setCurrency] = useState('USD');
  useEffect(() => {
    if (settings) {
      setModes(settings.categoryModes);
      setLimit(String(settings.dailyRequestLimit));
      setCap(
        settings.estimatedCostCap
          ? String(settings.estimatedCostCap.amount)
          : '',
      );
      setCurrency(settings.estimatedCostCap?.currency ?? 'USD');
    }
  }, [settings]);
  if (!settings || !modes) return null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const preferences: Preferences = {
          categoryModes: modes,
          dailyRequestLimit: Number(limit),
          languages: ['en'],
          estimatedCostCap:
            cap === '' ? null : { amount: Number(cap), currency },
        };
        void controller.setPreferences(preferences);
      }}
    >
      <section aria-labelledby="categories-title">
        <h2 id="categories-title">Choose what stays in your feed</h2>
        <p>
          Show normally is neutral: another hidden category can still hide the
          post. Always show protects matching posts. Every category starts at
          Show normally.
        </p>
        {CATEGORY_DEFINITIONS.map((category) => (
          <CategoryControl
            key={category.id}
            label={category.label}
            description={category.definition}
            value={modes[category.id]}
            disabled={state.busy}
            onChange={(mode) => setModes({ ...modes, [category.id]: mode })}
          />
        ))}
      </section>
      <section aria-labelledby="limits-title">
        <h2 id="limits-title">Set usage limits</h2>
        <p>
          Connection tests, failures, and retries can count as requests. Cost
          estimates are local estimates, not a provider spending guarantee.
        </p>
        <div className="ci-fields">
          <label>
            Daily request limit
            <input
              type="number"
              required
              min="1"
              max="100000"
              step="1"
              value={limit}
              disabled={state.busy}
              onChange={(event) => setLimit(event.target.value)}
            />
          </label>
          <label>
            Optional estimated daily cost cap
            <input
              type="number"
              min="0.000001"
              step="any"
              value={cap}
              disabled={state.busy}
              onChange={(event) => setCap(event.target.value)}
            />
          </label>
          <label>
            Cost cap currency
            <input
              type="text"
              required
              pattern="[A-Z]{3}"
              maxLength={3}
              value={currency}
              disabled={state.busy}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
            />
          </label>
        </div>
        <p className="ci-muted">
          Cost unavailable until the provider supplies usable pricing and usage.
          A cost cap blocks requests when a conservative estimate is
          unavailable. English is the initial classification language.
        </p>
        <Button type="submit" disabled={state.busy}>
          Save rules and limits
        </Button>
      </section>
    </form>
  );
}

export function OptionsSurface({
  controller,
}: {
  controller: OptionsController;
}) {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const environment = controller.environment;
  const [providerId, setProviderId] = useState<ProviderId>('typesafe');
  const [modelId, setModelId] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const credentialForm = useRef<HTMLFormElement>(null);
  const provider = environment.providers.find((item) => item.id === providerId);
  const configured =
    state.settings?.provider === providerId && state.settings.model === modelId;
  const canConfigure = provider?.available === true && modelId !== '';
  useEffect(() => {
    void controller.start();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => {
    if (state.settings?.provider) {
      setProviderId(state.settings.provider);
      setModelId(state.settings.model ?? '');
    } else {
      setModelId('');
    }
    setConsentChecked(false);
    credentialForm.current?.reset();
  }, [state.settings]);
  useEffect(() => {
    credentialForm.current?.reset();
    setConsentChecked(false);
  }, [providerId, modelId]);
  const ready =
    configured &&
    state.test === 'passed' &&
    state.permission &&
    state.status?.credentialConfigured;
  return (
    <Frame demo={environment.mode === 'demo'}>
      {environment.mode === 'unavailable' && (
        <Notice>
          Development build: runtime integration is pending. Provider
          connections and filtering are unavailable. Do not enter API keys into
          this build.
        </Notice>
      )}
      <p>
        Choose categories, connect your own provider, then explicitly consent.
        Until you enable filtering, your feed stays untouched.
      </p>
      {state.loading && <p role="status">Loading settings…</p>}
      {state.error && <Notice error>{state.error}</Notice>}
      <p className="ci-feedback" role="status" aria-live="polite">
        {state.notice}
      </p>
      {state.status && (
        <section aria-labelledby="activity-title">
          <h2 id="activity-title">
            {environment.mode === 'demo' ? 'Simulated status: ' : ''}
            {state.status.enabled
              ? 'Filtering is active'
              : 'Filtering is paused'}
          </h2>
          <p>{statusCopy(state.status)}</p>
          <p>
            {state.status.dailyRequestsUsed} of {state.status.dailyRequestLimit}{' '}
            daily requests used. Cost unavailable in public status.
          </p>
          {resetCopy(state.status) && <p>{resetCopy(state.status)}</p>}
          {state.status.error?.retryAfterMs !== undefined && (
            <p>
              Retry after {Math.ceil(state.status.error.retryAfterMs / 1000)}{' '}
              seconds.
            </p>
          )}
          <Button
            disabled={
              state.busy ||
              (!state.status.enabled &&
                (!ready || state.settings?.consent?.status !== 'granted'))
            }
            onClick={() => void controller.setEnabled(!state.status?.enabled)}
          >
            {state.status.enabled ? 'Pause filtering' : 'Enable filtering'}
          </Button>
        </section>
      )}
      <section aria-labelledby="provider-title">
        <h2 id="provider-title">Connect a provider</h2>
        <p>
          Selected rendered post text and packaged classification instructions
          go to your chosen provider. Post bodies may contain personal
          information. ClearedIn’s website does not receive your feed or key.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfigure)
              void controller.selectProvider(providerId, modelId);
          }}
        >
          <div className="ci-fields">
            <label>
              Provider
              <select
                value={providerId}
                disabled={state.busy}
                onChange={(event) => {
                  const id = event.target.value as ProviderId;
                  setProviderId(id);
                  setModelId(
                    environment.providers.find((item) => item.id === id)
                      ?.models[0]?.id ?? '',
                  );
                }}
              >
                {environment.providers.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                    {!item.available ? ' — unavailable' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model
              <select
                value={modelId}
                disabled={state.busy || !provider?.available}
                onChange={(event) => setModelId(event.target.value)}
              >
                <option value="">Select a verified model</option>
                {provider?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {provider && !provider.available && (
            <p>{provider.unavailableReason}</p>
          )}
          <p>
            Changing provider disables filtering and requires fresh consent for
            the new recipient.
          </p>
          <Button
            type="submit"
            disabled={state.busy || !canConfigure || configured}
          >
            Save provider and model
          </Button>
        </form>
        <h3>Allow provider host access</h3>
        <p>
          {state.permission && configured
            ? 'Host access granted.'
            : `Grant optional access to ${provider?.permissionLabel ?? 'the verified provider host'}. A browser permission is separate from transmission consent.`}
        </p>
        <Button
          disabled={state.busy || !configured || !provider?.available}
          onClick={() => void controller.requestPermission()}
        >
          Grant provider host access
        </Button>
        <h3>Enter a session credential</h3>
        <p>
          Only the privileged extension broker receives the key. It is kept for
          the browser session and may require re-entry after restart. It is
          excluded from settings and diagnostic previews.
        </p>
        <form
          ref={credentialForm}
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem(
              'credential',
            ) as HTMLInputElement | null;
            const credential = input?.value ?? '';
            event.currentTarget.reset();
            if (credential) void controller.setCredential(credential);
          }}
        >
          <label>
            Provider credential
            <input
              name="credential"
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={4096}
              required
              disabled={
                state.busy ||
                !configured ||
                !state.permission ||
                !environment.credentialEntry ||
                environment.mode !== 'connected'
              }
            />
          </label>
          <Button
            type="submit"
            disabled={
              state.busy ||
              !configured ||
              !state.permission ||
              !environment.credentialEntry ||
              environment.mode !== 'connected'
            }
          >
            Save session credential
          </Button>
        </form>
        {environment.mode === 'demo' && (
          <p>
            The demo uses a fixed synthetic credential flag. Credential entry is
            disabled.
          </p>
        )}
        {state.status && (
          <p>
            {state.status.credentialConfigured
              ? 'Session credential configured. Its value is never returned here.'
              : 'No session credential configured.'}
          </p>
        )}
        <h3>Test with synthetic text</h3>
        <p>
          The packaged synthetic connection test contains no feed text. A real
          provider test may incur a charge and count toward limits.
        </p>
        <Button
          disabled={
            state.busy ||
            !configured ||
            !state.permission ||
            !state.status?.credentialConfigured
          }
          onClick={() => void controller.testConnection()}
        >
          {state.test === 'pending'
            ? 'Testing connection…'
            : 'Run synthetic connection test'}
        </Button>
        <p role="status">
          {state.test === 'passed'
            ? environment.mode === 'demo'
              ? 'UI simulation passed; no live connection tested.'
              : 'Synthetic connection test passed.'
            : state.test === 'failed'
              ? 'Connection test failed. Review the error and try again.'
              : state.test === 'pending'
                ? 'Waiting for the connection test. Filtering stays off.'
                : 'Connection has not been tested in this settings session.'}
        </p>
      </section>
      <PreferencesForm controller={controller} />
      <section aria-labelledby="consent-title">
        <h2 id="consent-title">Review and consent</h2>
        <p>
          Recipient: {provider?.recipientId ?? 'Select a provider'}. Data:
          rendered post text and classification instructions. Purpose: classify
          post categories to apply your rules. Provider billing and retention
          policies apply. Clearing extension data cannot delete text already
          sent to a provider.
        </p>
        {provider?.retentionUrl ? (
          <p>
            <a href={provider.retentionUrl} target="_blank" rel="noreferrer">
              Read {provider.label} retention policy
            </a>
          </p>
        ) : (
          <p>
            {environment.mode === 'demo'
              ? 'This simulation has no recipient and retains no data after you exit the demo.'
              : 'A verified provider retention disclosure is required before consent is available.'}
          </p>
        )}
        <label className="ci-check">
          <input
            type="checkbox"
            checked={consentChecked}
            disabled={state.busy || !ready}
            onChange={(event) => setConsentChecked(event.target.checked)}
          />
          I agree to send rendered post text and classification instructions to{' '}
          {provider?.label ?? 'the selected provider'} for category
          classification and understand possible charges and provider retention.
        </label>
        <div className="ci-actions">
          <Button
            disabled={
              state.busy ||
              !ready ||
              !consentChecked ||
              (!provider?.retentionUrl && environment.mode !== 'demo')
            }
            onClick={() => void controller.consent(true)}
          >
            Record consent
          </Button>
          <Button
            className="ci-secondary"
            disabled={
              state.busy ||
              !state.settings?.consent ||
              state.settings.consent.status !== 'granted'
            }
            onClick={() => void controller.consent(false)}
          >
            Withdraw consent
          </Button>
        </div>
        <p>
          Declining leaves your feed untouched. Withdraw consent or pause at any
          time to stop new requests and restore hidden posts.
        </p>
      </section>
      <section aria-labelledby="data-title">
        <h2 id="data-title">Data and diagnostics</h2>
        <p>
          Disconnect removes the selected session credential and disables
          filtering. Global request accounting remains until its normal
          retention expires.
        </p>
        <Button
          className="ci-secondary"
          disabled={state.busy || !state.settings?.provider}
          onClick={() => void controller.disconnect()}
        >
          Disconnect provider
        </Button>
        <p>
          Clear all data removes local configuration, consent, credentials,
          cache, diagnostics, and usage records, then returns to disabled
          onboarding. A non-secret generation marker remains to reject stale
          work.
        </p>
        <label className="ci-check">
          <input
            type="checkbox"
            checked={confirmClear}
            disabled={state.busy}
            onChange={(event) => setConfirmClear(event.target.checked)}
          />
          I want to clear all local extension data.
        </label>
        <Button
          className="ci-danger"
          disabled={state.busy || !confirmClear}
          onClick={() => {
            setConfirmClear(false);
            void controller.clearData();
          }}
        >
          Clear all data
        </Button>
        <h3>Preview sanitized diagnostics</h3>
        <p>
          Local only. Preview includes version, browser, provider/model and
          allowlisted error/timing codes. Never attach real feed captures or
          keys to support messages.
        </p>
        <Button
          className="ci-secondary"
          disabled={state.busy}
          onClick={() => void controller.previewDiagnostics()}
        >
          Preview diagnostics
        </Button>
        {state.diagnostics && (
          <label>
            Review before sharing
            <textarea
              readOnly
              rows={10}
              value={JSON.stringify(state.diagnostics, null, 2)}
            />
          </label>
        )}
      </section>
    </Frame>
  );
}
