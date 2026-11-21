import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultSettings,
  type ClassificationInput,
  type ClassifierAdapter,
  type MessageSender,
  type ProviderConfiguration,
} from '@clearedin/contracts';
import { createStorageBrowserFixture } from '@clearedin/test-fixtures/storage';
import { createBroker } from '../../apps/extension/src/background/broker';

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
const feed = { ...options, url: 'https://www.linkedin.com/feed/', tabId: 2 };
const config = {
  provider: 'openai',
  model: 'test-model',
  adapterVersion: '1',
  taxonomyVersion: '1',
  promptVersion: '1',
} as const satisfies ProviderConfiguration;
const consent = {
  version: '1',
  provider: config.provider,
  recipientId: 'https://api.example.test',
  dataClasses: ['post_text', 'classification_instructions'],
  timestamp: 100,
  status: 'granted',
};
const post = {
  identity: {
    postId: 'local-identity',
    contentDigest: '0'.repeat(64),
    nodeGeneration: 1,
  },
  text: 'A synthetic technical post',
  extraction: 'complete',
  localSponsored: false,
  extractorVersion: '1',
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function answer(input: ClassificationInput) {
  return {
    ...config,
    schemaVersion: 1 as const,
    requestId: input.requestId,
    sufficiency: 'sufficient' as const,
    abstention: null,
    categories: [],
  };
}
function setup() {
  const fixture = createStorageBrowserFixture();
  const classify = vi.fn<ClassifierAdapter['classify']>(async (input) =>
    answer(input),
  );
  const live = {
    configuration: () => config,
    recipientId: () => consent.recipientId,
    adapter: () => ({ id: config.provider, classify }),
  };
  const broker = createBroker({
    live,
    extension,
    clock: fixture.clock,
    browser: fixture.ports,
    timeZone: 'UTC',
  });
  let sequence = 0;
  const send = (type: string, fields = {}, sender = options) =>
    broker.handle(
      {
        protocolVersion: 1,
        requestId: `request-${++sequence}`,
        type,
        ...fields,
      },
      sender,
    );
  const setKey = () =>
    send('SET_CREDENTIAL', {
      provider: config.provider,
      credential: 'synthetic-secret',
    });
  async function configure() {
    expect(
      await send('SET_PROVIDER', {
        provider: config.provider,
        model: config.model,
      }),
    ).toMatchObject({ type: 'ACK' });
    fixture.setProviderPermission(config.provider, true);
    expect(await setKey()).toMatchObject({ type: 'ACK' });
  }
  const preferences = (({
    categoryModes,
    languages,
    estimatedCostCap,
    dailyRequestLimit,
  }) => ({
    categoryModes: { ...categoryModes, technical_content: 'hide' },
    languages,
    estimatedCostCap,
    dailyRequestLimit,
  }))(createDefaultSettings());
  async function enable() {
    await configure();
    expect(await send('TEST_PROVIDER_CONNECTION')).toMatchObject({
      type: 'PROVIDER_TEST_RESULT',
      outcome: 'passed',
    });
    expect(await send('SET_PREFERENCES', { preferences })).toMatchObject({
      type: 'ACK',
    });
    expect(await send('SET_CONSENT', { consent })).toMatchObject({
      type: 'ACK',
    });
    const enabled = await send('SET_ENABLED', { enabled: true });
    if (enabled.type !== 'ACK') throw new Error('setup failed');
    return enabled.enablementGeneration;
  }
  return {
    broker,
    fixture,
    classify,
    send,
    setKey,
    configure,
    enable,
    preferences,
  };
}

describe('live home-feed broker', () => {
  it('requires the chosen host and matching disclosure; synthetic and feed requests share the spending limit', async () => {
    const h = setup();
    await h.send('SET_PROVIDER', {
      provider: config.provider,
      model: config.model,
    });
    expect(await h.setKey()).toMatchObject({
      error: { code: 'permission_denied' },
    });
    await h.configure();
    expect(await h.send('SET_ENABLED', { enabled: true })).toMatchObject({
      error: { code: 'consent_required' },
    });
    expect(
      await h.send('SET_CONSENT', {
        consent: { ...consent, recipientId: 'other' },
      }),
    ).toMatchObject({ error: { code: 'consent_required' } });
    expect(h.classify).not.toHaveBeenCalled();
    await h.send('SET_PREFERENCES', {
      preferences: { ...h.preferences, dailyRequestLimit: 1 },
    });
    expect(await h.send('TEST_PROVIDER_CONNECTION')).toMatchObject({
      outcome: 'passed',
    });
    expect(h.classify.mock.calls[0]![0].text).not.toBe(post.text);
    await h.send('SET_CONSENT', { consent });
    const enabled = await h.send('SET_ENABLED', { enabled: true });
    expect(enabled.type).toBe('ACK');
    const reply = await h.send(
      'CLASSIFY_POST',
      {
        post,
        enablementGeneration:
          enabled.type === 'ACK' ? enabled.enablementGeneration : 0,
      },
      feed,
    );
    expect(reply).toMatchObject({ error: { code: 'daily_limit' } });
    expect(h.classify).toHaveBeenCalledTimes(1);
    const snapshot = h.fixture.snapshot();
    expect(JSON.stringify([snapshot.local, snapshot.broadcasts])).not.toContain(
      'synthetic-secret',
    );
    expect(snapshot.session).toEqual({
      'clearedin.credential.openai': 'synthetic-secret',
    });
  });
  it('sends only minimized post input and rejects ads, non-feed pages, nonexistent generations, and removed permissions', async () => {
    const h = setup();
    const enablementGeneration = await h.enable();
    h.classify.mockClear();
    for (const [fields, sender] of [
      [{ post: { ...post, localSponsored: true }, enablementGeneration }, feed],
      [
        { post, enablementGeneration },
        { ...feed, url: 'https://www.linkedin.com/feed/update/123' },
      ],
      [{ post, enablementGeneration: enablementGeneration - 1 }, feed],
    ] as const)
      expect(await h.send('CLASSIFY_POST', fields, sender)).toMatchObject({
        type: 'ERROR',
      });
    expect(h.classify).not.toHaveBeenCalled();
    expect(
      await h.send('CLASSIFY_POST', { post, enablementGeneration }, feed),
    ).toMatchObject({
      type: 'CLASSIFICATION_RESULT',
      identity: post.identity,
    });
    expect(Object.keys(h.classify.mock.calls[0]![0]).sort()).toEqual([
      'extraction',
      'promptVersion',
      'requestId',
      'taxonomyVersion',
      'text',
    ]);
    h.fixture.setProviderPermission(config.provider, false);
    expect(
      await h.send('CLASSIFY_POST', { post, enablementGeneration }, feed),
    ).toMatchObject({ error: { code: 'permission_denied' } });
    expect(h.classify).toHaveBeenCalledTimes(1);
    await h.broker.permissionRemoved(config.provider);
    expect(h.fixture.snapshot().session).toEqual({});
    expect(await h.send('GET_PUBLIC_STATUS')).toMatchObject({
      status: { provider: null, enabled: false, consentGranted: false },
    });
  });
  it('withdraws consent during a slow call and restores the feed before the network returns', async () => {
    const h = setup();
    const enablementGeneration = await h.enable();
    const started = deferred<AbortSignal>();
    const finish = deferred<void>();
    h.classify.mockImplementationOnce(async (input, ctx) => {
      started.resolve(ctx.signal);
      await finish.promise;
      return answer(input);
    });
    const pending = h.send(
      'CLASSIFY_POST',
      { post, enablementGeneration },
      feed,
    );
    const signal = await started.promise;
    const revoked = await h.send('SET_CONSENT', {
      consent: { ...consent, status: 'withdrawn' },
    });
    expect(revoked.type).toBe('ACK');
    expect(signal.aborted).toBe(true);
    expect(h.fixture.snapshot().broadcasts.at(-2)).toMatchObject({
      type: 'RESTORE_ALL',
      reason: 'consent_withdrawn',
    });
    expect(await pending).toMatchObject({
      type: 'ERROR',
      error: { code: 'cancelled' },
    });
    finish.resolve();
    expect(await h.send('GET_PUBLIC_STATUS')).toMatchObject({
      status: { enabled: false, consentGranted: false },
    });
  });
  it('cancels a pending connection test on changing the key and ignores its late success', async () => {
    const h = setup();
    await h.configure();
    const started = deferred<AbortSignal>();
    const finish = deferred<void>();
    h.classify.mockImplementationOnce(async (input, ctx) => {
      started.resolve(ctx.signal);
      await finish.promise;
      return answer(input);
    });
    const test = h.send('TEST_PROVIDER_CONNECTION');
    const signal = await started.promise;
    expect(await h.setKey()).toMatchObject({ type: 'ACK' });
    expect(signal.aborted).toBe(true);
    finish.resolve();
    expect(await test).toMatchObject({
      type: 'ERROR',
      error: { code: 'cancelled' },
    });
  });

  it('withdraws the previous account consent and restores hidden posts if replacing its key fails', async () => {
    const h = setup();
    await h.enable();
    vi.spyOn(
      h.fixture.ports.trustedSessionStorage!,
      'set',
    ).mockRejectedValueOnce(new Error('synthetic write failure'));
    expect(await h.setKey()).toMatchObject({
      type: 'ERROR',
      error: { code: 'storage_unavailable' },
    });
    expect(h.fixture.snapshot().broadcasts.at(-1)).toMatchObject({
      type: 'RESTORE_ALL',
      reason: 'provider_changed',
    });
    expect(h.fixture.snapshot().local['clearedin.settings']).toMatchObject({
      settings: { enabled: false, consent: null },
    });
  });
});
