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
  Settings,
} from '@clearedin/contracts';
import { Button, CategoryControl, Notice } from './controls';
import { PROVIDER_LABELS } from './catalog';
import {
  resetCopy,
  statusCopy,
  statusHeading,
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
        <h1>{popup ? 'Feed filter' : 'Feed filter settings'}</h1>
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
  const reset = status && resetCopy(status);
  return (
    <Frame popup demo={mode === 'demo'}>
      {mode === 'unavailable' && (
        <Notice>
          Development build: live filtering and provider connections are
          unavailable. Open settings to save local rules or explore the
          synthetic demo.
        </Notice>
      )}
      {state.loading && <p role="status">Loading extension status…</p>}
      {state.error && (
        <>
          <Notice error>{state.error}</Notice>
          <Button
            className="ci-secondary"
            disabled={state.busy}
            onClick={() => void controller.refresh()}
          >
            Reload status
          </Button>
        </>
      )}
      {status && (
        <>
          <h2>{statusHeading(status)}</h2>
          <p>{statusCopy(status)}</p>
          <dl className="ci-stats">
            <div>
              <dt>Provider</dt>
              <dd>
                {status.provider
                  ? PROVIDER_LABELS[status.provider]
                  : 'Not selected'}
                {status.model && ` / ${status.model}`}
              </dd>
            </div>
            {mode === 'demo' && (
              <div>
                <dt>Hidden this session</dt>
                <dd>{status.sessionHiddenCount}</dd>
              </div>
            )}
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
          {reset && <p className="ci-muted">{reset}</p>}
          {status.error?.retryAfterMs !== undefined && (
            <p>
              Retry after {Math.ceil(status.error.retryAfterMs / 1000)} seconds.
            </p>
          )}
          {status.dailyRequestsUsed === 0 && !status.error && (
            <p>No classification requests today.</p>
          )}
          {(status.enabled ||
            (mode !== 'unavailable' && status.consentGranted)) && (
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
          )}
        </>
      )}
      {mode !== 'unavailable' &&
        status?.error?.code !== 'unsupported_route' &&
        !status?.enabled && <p>Filtering runs on the LinkedIn home feed.</p>}
      <Button
        className={mode === 'unavailable' ? undefined : 'ci-secondary'}
        onClick={openSettings}
      >
        {status?.error?.code === 'invalid_credential'
          ? 'Update key in settings'
          : mode === 'connected' && status?.state === 'needs_setup'
            ? 'Set up feed filtering'
            : 'Open settings'}
      </Button>
      <p role="status" aria-live="polite">
        {state.notice}
      </p>
    </Frame>
  );
}

function SetupSection({
  id,
  title,
  collapsed,
  children,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  children: ReactNode;
}) {
  const heading = <h2 id={id}>{title}</h2>;
  return collapsed ? (
    <details className="ci-setup-details">
      <summary>{heading}</summary>
      {children}
    </details>
  ) : (
    <section aria-labelledby={id}>
      {heading}
      {children}
    </section>
  );
}

function PreferencesForm({
  controller,
  settings,
  busy,
}: {
  controller: OptionsController;
  settings: Settings;
  busy: boolean;
}) {
  const [ruleEdits, setRuleEdits] = useState<Partial<CategoryModes>>({});
  const [limitEdit, setLimit] = useState<string | null>(null);
  const [capEdit, setCap] = useState<string | null>(null);
  const [currencyEdit, setCurrency] = useState<string | null>(null);
  const connected = controller.environment.mode === 'connected';
  const editableCategories = connected
    ? CATEGORY_DEFINITIONS.filter(({ id }) => id !== 'sponsored')
    : CATEGORY_DEFINITIONS;
  const modes = { ...settings.categoryModes, ...ruleEdits };
  const savedLimit = String(settings.dailyRequestLimit);
  const savedCap = settings.estimatedCostCap
    ? String(settings.estimatedCostCap.amount)
    : '';
  const savedCurrency = settings.estimatedCostCap?.currency ?? 'USD';
  const limit = limitEdit ?? savedLimit;
  const cap = capEdit ?? savedCap;
  const currency = currencyEdit ?? savedCurrency;
  const dirty =
    CATEGORY_DEFINITIONS.some(
      ({ id }) => modes[id] !== settings.categoryModes[id],
    ) ||
    limit !== savedLimit ||
    cap !== savedCap ||
    (cap !== '' && currency !== savedCurrency);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const preferences: Preferences = {
          categoryModes: connected ? { ...modes, sponsored: 'show' } : modes,
          dailyRequestLimit: Number(limit),
          languages: ['en'],
          estimatedCostCap:
            cap === '' ? null : { amount: Number(cap), currency },
        };
        if (await controller.setPreferences(preferences)) {
          setRuleEdits({});
          setLimit(null);
          setCap(null);
          setCurrency(null);
        }
      }}
    >
      <section aria-labelledby="categories-title">
        <h2 id="categories-title">Choose what stays in your feed</h2>
        <p>
          Choose Hide to collapse matching posts. Always show takes priority
          when several categories match. Show normally leaves the decision to
          your other rules.
        </p>
        {connected && <p>Posts marked Sponsored or Promoted stay visible.</p>}
        {editableCategories.map((category) => (
          <CategoryControl
            key={category.id}
            label={category.label}
            description={category.definition}
            value={modes[category.id]}
            disabled={busy}
            onChange={(mode) =>
              setRuleEdits((edits) => {
                const next = { ...edits };
                if (mode === settings.categoryModes[category.id])
                  delete next[category.id];
                else next[category.id] = mode;
                return next;
              })
            }
          />
        ))}
      </section>
      <section aria-labelledby="limits-title">
        <h2 id="limits-title">Set usage limits</h2>
        <p>
          Connection tests, failures, and retries can count as requests. Your
          provider determines the amount billed.
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
              disabled={busy}
              onChange={(event) =>
                setLimit(
                  event.target.value === savedLimit ? null : event.target.value,
                )
              }
            />
          </label>
          <label>
            Optional estimated daily cost cap
            <input
              type="number"
              min="0.000001"
              step="any"
              value={cap}
              disabled={busy}
              onChange={(event) =>
                setCap(
                  event.target.value === savedCap ? null : event.target.value,
                )
              }
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
              disabled={busy || cap === ''}
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
        <div className="ci-actions">
          <Button type="submit" disabled={busy || !dirty}>
            Save rules and limits
          </Button>
          <span className="ci-muted">
            {dirty ? 'Unsaved changes' : 'No unsaved changes'}
          </span>
        </div>
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
  const localOnly = environment.mode === 'unavailable';
  const [providerId, setProviderId] = useState<ProviderId | ''>('');
  const [modelId, setModelId] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const credentialForm = useRef<HTMLFormElement>(null);
  const provider = environment.providers.find((item) => item.id === providerId);
  const configured =
    state.settings?.provider === providerId && state.settings.model === modelId;
  const savedProvider = state.settings?.provider;
  const savedModel = state.settings?.model;
  const recipient = environment.providers.find(
    (item) => item.id === savedProvider,
  );
  const canConfigure = provider?.available === true && modelId !== '';
  useEffect(() => {
    void controller.start();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => {
    setProviderId(savedProvider ?? '');
    setModelId(savedModel ?? '');
    setConsentChecked(false);
    credentialForm.current?.reset();
  }, [savedProvider, savedModel, state.dataRevision]);
  useEffect(() => {
    setConsentChecked(false);
  }, [state.settings?.consent?.status]);
  useEffect(() => {
    credentialForm.current?.reset();
    setConsentChecked(false);
  }, [providerId, modelId]);
  const ready =
    configured &&
    state.test === 'passed' &&
    state.permission &&
    state.status?.credentialConfigured;
  const hasConsent = state.status?.consentGranted === true;
  const canEnterKey =
    !state.busy &&
    configured &&
    state.permission &&
    environment.credentialEntry &&
    environment.mode === 'connected' &&
    state.status?.error?.code !== 'storage_unavailable';
  const preferences = state.settings && (
    <PreferencesForm
      key={state.dataRevision}
      controller={controller}
      settings={state.settings}
      busy={state.busy}
    />
  );
  const reset = state.status && resetCopy(state.status);
  return (
    <Frame demo={environment.mode === 'demo'}>
      {localOnly && (
        <Notice>
          Development build: category settings are saved locally. Provider
          connections and live filtering are unavailable. Do not enter API keys
          into this build.
        </Notice>
      )}
      {!localOnly && (
        <p>
          Connect your provider, choose the posts to hide, and review what
          leaves your browser. Filtering starts when you enable it.
        </p>
      )}
      {state.loading && <p role="status">Loading settings…</p>}
      {state.error && (
        <>
          <Notice error>{state.error}</Notice>
          <Button
            className="ci-secondary"
            disabled={state.busy}
            onClick={() => void controller.refresh()}
          >
            Reload settings
          </Button>
        </>
      )}
      <p className="ci-feedback" role="status" aria-live="polite">
        {state.notice}
      </p>
      <nav className="ci-settings-nav" aria-label="Settings sections">
        {state.settings && (
          <>
            <a href="#categories-title">Category rules</a>
            <a href="#limits-title">Usage limits</a>
          </>
        )}
        <a href="#provider-title">Provider setup</a>
        <a href="#consent-title">Consent</a>
        <a href="#data-title">Data and diagnostics</a>
      </nav>
      {state.status && (
        <section aria-labelledby="activity-title">
          <h2 id="activity-title">
            {environment.mode === 'demo' ? 'Simulated status: ' : ''}
            {statusHeading(state.status)}
          </h2>
          <p>{statusCopy(state.status)}</p>
          <p>
            {state.status.dailyRequestsUsed} of {state.status.dailyRequestLimit}{' '}
            daily requests used. Cost unavailable in public status.
          </p>
          {reset && <p>{reset}</p>}
          {state.status.error?.retryAfterMs !== undefined && (
            <p>
              Retry after {Math.ceil(state.status.error.retryAfterMs / 1000)}{' '}
              seconds.
            </p>
          )}
          {state.status.enabled && (
            <Button
              disabled={state.busy}
              onClick={() => void controller.setEnabled(false)}
            >
              Pause filtering
            </Button>
          )}
        </section>
      )}
      {localOnly && preferences}
      <SetupSection
        id="provider-title"
        title={localOnly ? 'Provider setup requirements' : 'Connect a provider'}
        collapsed={localOnly}
      >
        <p>
          Selected rendered post text and packaged classification instructions
          go to your chosen provider. Post bodies may contain personal
          information. ClearedIn’s website does not receive your feed or key.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfigure && providerId)
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
                  const id = event.target.value as ProviderId | '';
                  setProviderId(id);
                  setModelId(
                    environment.providers.find((item) => item.id === id)
                      ?.models[0]?.id ?? '',
                  );
                }}
              >
                <option value="">Choose a provider</option>
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
                <option value="">Choose a model</option>
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
            : `Grant the browser permissions for ${provider?.permissionLabel ?? 'your selected provider'}. You will review consent for sending feed text separately.`}
        </p>
        <Button
          disabled={
            state.busy ||
            !configured ||
            !provider?.available ||
            state.permission
          }
          onClick={() => void controller.requestPermission()}
        >
          {configured && state.permission
            ? 'Host access granted'
            : 'Grant provider host access'}
        </Button>
        <h3>Enter a session credential</h3>
        <p>
          Your API key stays in extension session storage and authenticates
          requests to your selected provider. Closing the browser clears the
          key. Enter it again after restarting the browser.
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
            Provider API key
            <input
              name="credential"
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={4096}
              required
              disabled={!canEnterKey}
            />
          </label>
          <Button type="submit" disabled={!canEnterKey}>
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
                ? 'Waiting for the connection test.'
                : 'Connection has not been tested in this settings session.'}
        </p>
      </SetupSection>
      {!localOnly && preferences}
      <SetupSection
        id="consent-title"
        title="Review and consent"
        collapsed={localOnly && state.settings?.consent?.status !== 'granted'}
      >
        <p>
          When filtering is enabled,{' '}
          {recipient?.label ?? 'your chosen provider'} receives visible post
          text and classification instructions to apply your rules on the
          desktop LinkedIn home feed. Provider billing and retention policies
          apply. Clearing extension data only clears this browser.
        </p>
        {environment.mode === 'connected' && (
          <p>
            Messages, comments and author details are excluded from extraction.
            Post text itself can contain names and other personal information.
            Classification thresholds are experimental and can hide a post
            incorrectly. Use Reveal to read it again.
          </p>
        )}
        {recipient?.retentionUrl ? (
          <p>
            <a href={recipient.retentionUrl} target="_blank" rel="noreferrer">
              Read about {recipient.label} data handling
            </a>
          </p>
        ) : (
          <p>
            {environment.mode === 'demo'
              ? 'This simulation has no recipient and retains no data after you exit the demo.'
              : 'Save your provider to review its data handling and record consent.'}
          </p>
        )}
        <label className="ci-check">
          <input
            type="checkbox"
            checked={hasConsent || consentChecked}
            disabled={state.busy || !ready || hasConsent}
            onChange={(event) => setConsentChecked(event.target.checked)}
          />
          I agree to send rendered post text and classification instructions to{' '}
          {recipient?.label ?? 'the selected provider'} for category
          classification and understand possible charges and provider retention.
          {environment.mode === 'connected' &&
            ' I want to use these experimental filters.'}
        </label>
        <div className="ci-actions">
          <Button
            disabled={
              state.busy ||
              !ready ||
              !consentChecked ||
              hasConsent ||
              (!recipient?.retentionUrl && environment.mode !== 'demo')
            }
            onClick={() => void controller.consent(true)}
          >
            {hasConsent ? 'Consent recorded' : 'Record consent'}
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
        {!localOnly && !state.status?.enabled && (
          <Button
            disabled={state.busy || !ready || !hasConsent}
            onClick={() => void controller.setEnabled(true)}
          >
            Enable filtering
          </Button>
        )}
        {hasConsent &&
          state.settings &&
          !Object.entries(state.settings.categoryModes).some(
            ([id, mode]) =>
              mode === 'hide' &&
              (environment.mode !== 'connected' || id !== 'sponsored'),
          ) && (
            <p>
              Choose Hide for at least one{' '}
              <a href="#categories-title">category</a> to start filtering posts.
            </p>
          )}
        <p>
          Declining leaves your feed untouched. Withdraw consent or pause at any
          time to stop new requests and restore hidden posts.
        </p>
      </SetupSection>
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
