import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultSettings,
  type MessageSender,
} from '@clearedin/contracts';
import { createStorageBrowserFixture } from '@clearedin/test-fixtures/storage';
import { SETTINGS_KEY, USAGE_KEY } from '@clearedin/storage';
import { createBroker } from '../../apps/extension/src/background/broker';
import { createMessageClient } from '../../apps/extension/src/messaging/client';

const extension = {
  id: 'test',
  optionsUrl: 'chrome-extension://test/options.html',
  popupUrl: 'chrome-extension://test/popup.html',
  version: '0.1.0',
};
const options: MessageSender = {
  extensionId: 'test',
  url: extension.optionsUrl,
  tabId: 1,
  frameId: 0,
};
const content: MessageSender = {
  ...options,
  url: 'https://www.linkedin.com/feed/',
};
const request = (type: string, fields = {}) => ({
  protocolVersion: 1,
  requestId: 'test-request',
  type,
  ...fields,
});
function setup() {
  const fixture = createStorageBrowserFixture();
  const make = () =>
    createBroker({
      browser: fixture.ports,
      clock: fixture.clock,
      timeZone: 'UTC',
      extension,
    });
  return { fixture, broker: make(), make };
}

describe('production settings broker (injected browser ports)', () => {
  it('persists preferences across background recreation and resets them', async () => {
    const { broker, make } = setup();
    const { categoryModes, dailyRequestLimit, estimatedCostCap, languages } =
      createDefaultSettings();
    const saved = await broker.handle(
      request('SET_PREFERENCES', {
        preferences: {
          categoryModes: { ...categoryModes, engagement_bait: 'hide' },
          dailyRequestLimit,
          estimatedCostCap,
          languages,
        },
      }),
      options,
    );
    expect(saved.type).toBe('ACK');
    const next = make();
    const result = await next.handle(request('GET_SETTINGS'), options);
    expect(
      result.type === 'SETTINGS' &&
        result.settings.categoryModes.engagement_bait,
    ).toBe('hide');
    expect((await next.handle(request('CLEAR_DATA'), options)).type).toBe(
      'ACK',
    );
    const cleared = await next.handle(request('GET_SETTINGS'), options);
    expect(cleared.type === 'SETTINGS' && cleared.settings).toEqual(
      createDefaultSettings(),
    );
  });

  it.each([
    'SET_CREDENTIAL',
    'GET_SETTINGS',
    'CLEAR_DATA',
    'EXPORT_DIAGNOSTICS',
    'TEST_PROVIDER_CONNECTION',
  ])('rejects content privilege escalation: %s', async (type) => {
    const { broker } = setup();
    const reply = await broker.handle(
      request(
        type,
        type === 'SET_CREDENTIAL'
          ? { provider: 'openai', credential: 'synthetic-secret' }
          : {},
      ),
      content,
    );
    expect(reply.type).toBe('ERROR');
  });

  it.each([
    { ...options, extensionId: 'other' },
    { ...options, frameId: 1 },
    { ...options, url: `${extension.optionsUrl}/evil` },
    { ...content, url: 'https://www.linkedin.com/messaging/' },
    { ...content, url: 'https://www.linkedin.com.evil.test/feed/' },
    { ...content, frameId: null },
  ])('rejects untrusted browser metadata %#', async (sender) => {
    const { broker } = setup();
    expect(
      (await broker.handle(request('GET_PUBLIC_STATUS'), sender)).type,
    ).toBe('ERROR');
  });

  it('never stores credentials or enables an unverified provider', async () => {
    const { broker, fixture } = setup();
    for (const message of [
      request('SET_CREDENTIAL', {
        provider: 'openai',
        credential: 'synthetic-secret',
      }),
      request('SET_ENABLED', { enabled: true }),
      request('SET_PROVIDER', { provider: 'openai', model: 'any' }),
    ]) {
      expect(await broker.handle(message, options)).toMatchObject({
        type: 'ERROR',
        error: { code: 'unsupported_provider' },
      });
    }
    expect(JSON.stringify(fixture.snapshot())).not.toContain(
      'synthetic-secret',
    );
    expect(fixture.snapshot().session).toEqual({});
  });

  it('serializes concurrent clears and status notifications without lost generations', async () => {
    const { broker, fixture } = setup();
    const replies = await Promise.all(
      Array.from({ length: 5 }, () =>
        broker.handle(request('CLEAR_DATA'), options),
      ),
    );
    expect(
      replies.map(
        (reply) => reply.type === 'ACK' && reply.enablementGeneration,
      ),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(fixture.snapshot().broadcasts).toHaveLength(10);
  });

  it('reports incompatible settings and preserves their generation on explicit reset', async () => {
    const { broker, fixture } = setup();
    await fixture.ports.localStorage.set(SETTINGS_KEY, {
      schemaVersion: 2,
      enablementGeneration: 7,
    });
    expect(
      await broker.handle(request('GET_PUBLIC_STATUS'), options),
    ).toMatchObject({
      type: 'PUBLIC_STATUS',
      status: { error: { code: 'unsupported_schema' }, enabled: false },
    });
    expect(await broker.handle(request('CLEAR_DATA'), options)).toMatchObject({
      type: 'ACK',
      enablementGeneration: 8,
    });
  });

  it('recovers from a corrupt ledger and malformed generation via the options command', async () => {
    const { broker, fixture } = setup();
    await fixture.ports.localStorage.set(USAGE_KEY, { schemaVersion: 2 });
    expect(
      await broker.handle(request('GET_PUBLIC_STATUS'), options),
    ).toMatchObject({
      type: 'ERROR',
      error: { code: 'unsupported_schema' },
    });
    await fixture.ports.localStorage.set(SETTINGS_KEY, {
      enablementGeneration: 'damaged',
    });
    expect(await broker.handle(request('CLEAR_DATA'), options)).toMatchObject({
      type: 'ACK',
      enablementGeneration: 1,
    });
    expect(await broker.handle(request('GET_SETTINGS'), options)).toMatchObject(
      {
        type: 'SETTINGS',
        settings: createDefaultSettings(),
      },
    );
    expect(
      await broker.handle(request('GET_PUBLIC_STATUS'), options),
    ).toMatchObject({
      type: 'PUBLIC_STATUS',
      status: { dailyRequestsUsed: 0, enabled: false },
    });
  });

  it('can clear data in the same worker after a transient storage failure', async () => {
    const { broker, fixture } = setup();
    vi.spyOn(fixture.ports.localStorage, 'set').mockRejectedValueOnce(
      new Error('write failed'),
    );
    expect(
      await broker.handle(request('GET_PUBLIC_STATUS'), options),
    ).toMatchObject({
      type: 'ERROR',
      error: { code: 'storage_unavailable' },
    });
    expect(await broker.handle(request('CLEAR_DATA'), options)).toMatchObject({
      type: 'ACK',
      enablementGeneration: 1,
    });
  });

  it('rejects schema extras instead of accepting payload sender claims', async () => {
    const { broker } = setup();
    expect(
      (
        await broker.handle(
          request('GET_PUBLIC_STATUS', { surface: 'options' }),
          content,
        )
      ).type,
    ).toBe('ERROR');
  });
});

describe('validated UI transport', () => {
  it('round-trips real broker status and never exposes private state', async () => {
    const { broker } = setup();
    const client = createMessageClient({
      sendMessage: (message) => broker.handle(message, options),
      subscribe: () => () => {},
    });
    expect(
      await client.send({
        protocolVersion: 1,
        requestId: 'ui',
        type: 'GET_PUBLIC_STATUS',
      }),
    ).toMatchObject({
      type: 'PUBLIC_STATUS',
      status: {
        state: 'unavailable',
        credentialConfigured: false,
        enabled: false,
      },
    });
  });
  it('rejects miscorrelated and wrong-type replies', async () => {
    for (const requestId of ['wrong', 'ui']) {
      const client = createMessageClient({
        async sendMessage() {
          return {
            protocolVersion: 1,
            requestId,
            type: 'ACK',
            enablementGeneration: 0,
          };
        },
        subscribe: () => () => {},
      });
      await expect(
        client.send({
          protocolVersion: 1,
          requestId: 'ui',
          type: 'GET_PUBLIC_STATUS',
        }),
      ).rejects.toThrow('invalid_response');
    }
  });
});
