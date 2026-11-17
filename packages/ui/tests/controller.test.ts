import { describe, expect, it, vi } from 'vitest';
import {
  type BroadcastMessage,
  type OptionsClient,
  type OptionsRequest,
  type ReplyFor,
  type PublicStatus,
} from '@clearedin/contracts';
import {
  createDemoSession,
  createOptionsController,
  createPopupController,
  createUnavailableClient,
  ERROR_COPY,
  statusCopy,
  UNAVAILABLE_ENVIRONMENT,
} from '../src/index';

function harness() {
  const session = createDemoSession();
  const requests: OptionsRequest[] = [];
  const listeners = new Set<(event: BroadcastMessage) => void>();
  const client: OptionsClient = {
    async send(request) {
      requests.push(request);
      return session.client.send(request);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    session,
    requests,
    client,
    listeners,
    controller: createOptionsController(client, session.environment),
  };
}
async function setup() {
  const h = harness();
  await h.controller.start();
  await h.controller.selectProvider('openai', 'SYNTHETIC-UI-ONLY');
  await h.controller.requestPermission();
  return h;
}

describe('options controller using frozen transport', () => {
  it('loads neutral categories, requires permission/test/explicit consent before enablement', async () => {
    const h = harness();
    await h.controller.start();
    expect(
      Object.values(h.controller.getSnapshot().settings!.categoryModes),
    ).toEqual(Array(12).fill('show'));
    await h.controller.selectProvider('openai', 'SYNTHETIC-UI-ONLY');
    await h.controller.testConnection();
    expect(
      h.requests.some((request) => request.type === 'TEST_PROVIDER_CONNECTION'),
    ).toBe(false);
    await h.controller.setEnabled(true);
    expect(h.controller.getSnapshot().status?.enabled).toBe(false);
    await h.controller.requestPermission();
    await h.controller.testConnection();
    expect(h.controller.getSnapshot().test).toBe('passed');
    await h.controller.setEnabled(true);
    expect(h.controller.getSnapshot().status?.enabled).toBe(false);
    await h.controller.consent(true);
    await h.controller.setEnabled(true);
    expect(h.controller.getSnapshot().status?.enabled).toBe(true);
    const consent = h.requests.find(
      (request) => request.type === 'SET_CONSENT',
    );
    expect(consent).toMatchObject({
      consent: {
        provider: 'openai',
        dataClasses: ['post_text', 'classification_instructions'],
        status: 'granted',
      },
    });
    await h.controller.consent(false);
    expect(h.controller.getSnapshot().status?.enabled).toBe(false);
    expect(h.controller.getSnapshot().settings?.consent?.status).toBe(
      'withdrawn',
    );
  });

  it('provider/model changes invalidate consent and test, disconnect/clear reset disabled', async () => {
    const h = await setup();
    await h.controller.testConnection();
    await h.controller.consent(true);
    await h.controller.setEnabled(true);
    await h.controller.selectProvider('anthropic', 'SYNTHETIC-UI-ONLY');
    expect(h.controller.getSnapshot()).toMatchObject({
      test: 'idle',
      permission: false,
      settings: { consent: null, enabled: false },
    });
    await h.controller.disconnect();
    expect(h.controller.getSnapshot().settings?.provider).toBeNull();
    await h.controller.clearData();
    expect(h.controller.getSnapshot().settings).toMatchObject({
      provider: null,
      consent: null,
      enabled: false,
      dailyRequestLimit: 200,
    });
  });
  it('allows consent withdrawal even after the configured provider becomes unavailable', async () => {
    const h = await setup();
    await h.controller.testConnection();
    await h.controller.consent(true);
    const controller = createOptionsController(h.client, {
      ...h.session.environment,
      mode: 'connected',
      providers: h.session.environment.providers.map((provider) => ({
        ...provider,
        available: false,
        retentionUrl: null,
      })),
    });
    await controller.start();
    await controller.consent(false);
    expect(controller.getSnapshot().settings?.consent?.status).toBe(
      'withdrawn',
    );
    expect(controller.getSnapshot().status?.enabled).toBe(false);
  });

  it('validates rules and limits without silently changing category modes', async () => {
    const h = await setup();
    const settings = h.controller.getSnapshot().settings!;
    const preferences = {
      categoryModes: {
        ...settings.categoryModes,
        technical_content: 'always_show' as const,
        engagement_bait: 'hide' as const,
      },
      dailyRequestLimit: 42,
      estimatedCostCap: { amount: 2.5, currency: 'USD' },
      languages: ['en' as const],
    };
    await h.controller.setPreferences(preferences);
    expect(h.controller.getSnapshot().settings).toMatchObject(preferences);
    await h.controller.setPreferences({ ...preferences, dailyRequestLimit: 0 });
    expect(h.controller.getSnapshot().error).toBe(ERROR_COPY.invalid_request);
    expect(h.controller.getSnapshot().settings?.dailyRequestLimit).toBe(42);
  });

  it('rejects credentials in demo and unavailable clients, never places them in snapshots', async () => {
    const h = await setup();
    await h.controller.setCredential('SYNTHETIC-TEST-SECRET');
    expect(
      h.requests.some((request) => request.type === 'SET_CREDENTIAL'),
    ).toBe(false);
    expect(JSON.stringify(h.controller.getSnapshot())).not.toContain(
      'SYNTHETIC-TEST-SECRET',
    );
    const reply = await h.session.client.send({
      protocolVersion: 1,
      requestId: 'test',
      type: 'SET_CREDENTIAL',
      provider: 'openai',
      credential: 'SYNTHETIC-TEST-SECRET',
    });
    expect(reply.type).toBe('ERROR');
    const controller = createOptionsController(
      createUnavailableClient(),
      UNAVAILABLE_ENVIRONMENT,
    );
    await controller.start();
    expect(controller.getSnapshot().settings).toBeNull();
    expect(controller.getSnapshot().error).toBe(ERROR_COPY.internal_error);
  });

  it('connected credential goes only in the options command; transport exceptions are sanitized', async () => {
    const h = await setup();
    const connected = createOptionsController(
      {
        ...h.client,
        async send(request) {
          if (request.type === 'SET_CREDENTIAL') {
            h.requests.push(request);
            throw new Error(`upstream echoes ${request.credential}`);
          }
          return h.client.send(request);
        },
      },
      { ...h.session.environment, mode: 'connected', credentialEntry: true },
    );
    await connected.start();
    await connected.setCredential('SYNTHETIC-TEST-SECRET');
    expect(
      h.requests.filter((request) => request.type === 'SET_CREDENTIAL'),
    ).toHaveLength(1);
    expect(connected.getSnapshot().error).toBe(ERROR_COPY.internal_error);
    expect(JSON.stringify(connected.getSnapshot())).not.toContain(
      'SYNTHETIC-TEST-SECRET',
    );
  });

  it('renders pending and failed test states without exposing provider payloads', async () => {
    const h = await setup();
    let finish: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const client: OptionsClient = {
      ...h.client,
      async send(request) {
        if (request.type === 'TEST_PROVIDER_CONNECTION') {
          await wait;
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            type: 'ERROR',
            error: { code: 'invalid_credential', retryable: false },
          } as ReplyFor<typeof request>;
        }
        return h.client.send(request);
      },
    };
    const controller = createOptionsController(client, h.session.environment);
    await controller.start();
    const pending = controller.testConnection();
    expect(controller.getSnapshot()).toMatchObject({
      busy: true,
      test: 'pending',
    });
    finish!();
    await pending;
    expect(controller.getSnapshot()).toMatchObject({
      busy: false,
      test: 'failed',
      error: ERROR_COPY.invalid_credential,
    });
  });

  it('invalidates a pending test immediately on external reset and reloads after it settles', async () => {
    const h = await setup();
    let finish: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const client: OptionsClient = {
      ...h.client,
      async send(request) {
        if (request.type === 'TEST_PROVIDER_CONNECTION') {
          await wait;
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            type: 'PROVIDER_TEST_RESULT',
            provider: 'openai',
            model: 'SYNTHETIC-UI-ONLY',
            outcome: 'passed',
            error: null,
          } as ReplyFor<typeof request>;
        }
        return h.client.send(request);
      },
    };
    const controller = createOptionsController(client, h.session.environment);
    await controller.start();
    const pending = controller.testConnection();
    await h.session.client.send({
      protocolVersion: 1,
      requestId: 'external-clear',
      type: 'CLEAR_DATA',
    });
    for (const listener of h.listeners)
      listener({
        protocolVersion: 1,
        requestId: 'broadcast',
        type: 'RESTORE_ALL',
        enablementGeneration: 2,
        reason: 'data_cleared',
      });
    expect(controller.getSnapshot().test).toBe('idle');
    finish!();
    await pending;
    expect(controller.getSnapshot()).toMatchObject({
      test: 'idle',
      settings: { provider: null, enabled: false, consent: null },
    });
    await controller.setEnabled(true);
    expect(controller.getSnapshot().status?.enabled).toBe(false);
  });

  it('keeps a valid test through usage broadcasts and consent/enablement acknowledgments', async () => {
    const h = await setup();
    const client: OptionsClient = {
      ...h.client,
      async send(request) {
        const reply = await h.client.send(request);
        if (
          ['TEST_PROVIDER_CONNECTION', 'SET_CONSENT', 'SET_ENABLED'].includes(
            request.type,
          )
        ) {
          const status = await h.session.client.send({
            protocolVersion: 1,
            requestId: 'broadcast-status',
            type: 'GET_PUBLIC_STATUS',
          });
          if (status.type === 'PUBLIC_STATUS')
            for (const listener of h.listeners)
              listener({
                protocolVersion: 1,
                requestId: 'broadcast',
                type: 'STATUS_CHANGED',
                status: status.status,
              });
        }
        return reply;
      },
    };
    const controller = createOptionsController(client, h.session.environment);
    await controller.start();
    await controller.testConnection();
    expect(controller.getSnapshot().test).toBe('passed');
    await controller.consent(true);
    expect(controller.getSnapshot().test).toBe('passed');
    await controller.setEnabled(true);
    expect(controller.getSnapshot().status?.enabled).toBe(true);
  });

  it('rejects diagnostics with extra sensitive fields and clears preview on reset', async () => {
    const h = await setup();
    await h.controller.previewDiagnostics();
    expect(h.controller.getSnapshot().diagnostics?.events).toEqual([]);
    await h.controller.clearData();
    expect(h.controller.getSnapshot().diagnostics).toBeNull();
    const bad: OptionsClient = {
      ...h.client,
      async send<R extends OptionsRequest>(request: R): Promise<ReplyFor<R>> {
        if (request.type === 'EXPORT_DIAGNOSTICS')
          return {
            protocolVersion: 1,
            requestId: request.requestId,
            type: 'DIAGNOSTICS',
            diagnostics: {
              schemaVersion: 1,
              extensionVersion: '1',
              browserFamily: 'chrome',
              events: [],
              credential: 'SYNTHETIC-TEST-SECRET',
            },
          } as unknown as ReplyFor<R>;
        return h.client.send(request);
      },
    };
    const controller = createOptionsController(bad, h.session.environment);
    await controller.start();
    await controller.previewDiagnostics();
    expect(controller.getSnapshot().diagnostics).toBeNull();
    expect(JSON.stringify(controller.getSnapshot())).not.toContain(
      'SYNTHETIC-TEST-SECRET',
    );
  });
  it('does not overwrite a newer usage broadcast with a pending status read', async () => {
    const h = await setup();
    let block = false;
    let finish!: () => void;
    let reading!: () => void;
    const waiting = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      reading = resolve;
    });
    const client: OptionsClient = {
      ...h.client,
      async send(request) {
        const reply = await h.client.send(request);
        if (block && request.type === 'GET_PUBLIC_STATUS') {
          reading();
          await waiting;
        }
        return reply;
      },
    };
    const controller = createOptionsController(client, h.session.environment);
    await controller.start();
    block = true;
    const refreshing = controller.refresh();
    await requested;
    const status = controller.getSnapshot().status!;
    for (const listener of h.listeners)
      listener({
        protocolVersion: 1,
        requestId: 'new-usage',
        type: 'STATUS_CHANGED',
        status: { ...status, dailyRequestsUsed: 5 },
      });
    finish();
    await refreshing;
    expect(controller.getSnapshot().status?.dailyRequestsUsed).toBe(5);
  });

  it('releases subscriptions and ignores late replies after dispose', async () => {
    const h = await setup();
    expect(h.listeners.size).toBe(1);
    const subscriber = vi.fn();
    h.controller.subscribe(subscriber);
    h.controller.dispose();
    expect(h.listeners.size).toBe(0);
    await h.controller.refresh();
    expect(subscriber).not.toHaveBeenCalled();
  });
});

describe('popup capability and public states', () => {
  it('only requests status and enabled changes, never credentials/settings', async () => {
    const h = await setup();
    const popup = createPopupController(h.client);
    await popup.start();
    await popup.setEnabled(false);
    const commands = h.requests.slice(-3).map((request) => request.type);
    expect(commands).toEqual([
      'GET_PUBLIC_STATUS',
      'SET_ENABLED',
      'GET_PUBLIC_STATUS',
    ]);
    expect('setCredential' in popup).toBe(false);
    expect('consent' in popup).toBe(false);
  });
  it('a late initial read cannot overwrite a newer broadcast', async () => {
    const h = await setup();
    const original = await h.session.client.send({
      protocolVersion: 1,
      requestId: 'read',
      type: 'GET_PUBLIC_STATUS',
    });
    if (original.type !== 'PUBLIC_STATUS')
      throw new Error('fixture status unavailable');
    let finish: (() => void) | undefined;
    const wait = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const popup = createPopupController({
      ...h.client,
      async send(request) {
        await wait;
        return { ...original, requestId: request.requestId } as ReplyFor<
          typeof request
        >;
      },
    });
    const starting = popup.start();
    for (const listener of h.listeners)
      listener({
        protocolVersion: 1,
        requestId: 'broadcast',
        type: 'STATUS_CHANGED',
        status: { ...original.status, enabled: true, enablementGeneration: 10 },
      });
    finish!();
    await starting;
    expect(popup.getSnapshot().status?.enablementGeneration).toBe(10);
  });
  it.each([
    'unsupported_route',
    'invalid_credential',
    'rate_limited',
    'daily_limit',
    'provider_unavailable',
    'permission_denied',
  ] as const)('shows honest %s state', async (code) => {
    const h = await setup();
    const status = h.controller.getSnapshot().status as PublicStatus;
    expect(statusCopy({ ...status, error: { code, retryable: false } })).toBe(
      ERROR_COPY[code],
    );
  });
});
