import { describe, expect, it, vi } from 'vitest';
import { authorizeRequest } from '../../apps/extension/src/messaging/authorization';
import { createScheduler } from '../../apps/extension/src/background/scheduler';
import type {
  ClassificationCacheKey,
  ClassificationResult,
  MessageSender,
} from '@clearedin/contracts';
import { createClassificationCache } from '@clearedin/storage';
import { createStorageBrowserFixture } from '@clearedin/test-fixtures/storage';
import { createBroker } from '../../apps/extension/src/background/broker';

const base = 'chrome-extension://test/';
const extension = {
  id: 'test',
  optionsUrl: `${base}options.html`,
  popupUrl: `${base}popup.html`,
  version: '0.1.0',
};
const authorize = (raw: unknown, sender: MessageSender) =>
  authorizeRequest(raw, sender, extension);
const key: ClassificationCacheKey = {
  provider: 'openai',
  model: 'synthetic',
  adapterVersion: '1',
  taxonomyVersion: '1',
  promptVersion: '1',
  contentDigest: 'a'.repeat(64),
  extraction: 'complete',
  extractorVersion: '1',
};
function schedulerFixture() {
  const fixture = createStorageBrowserFixture();
  return createScheduler({
    clock: fixture.clock,
    cache: createClassificationCache({ clock: fixture.clock }),
  });
}
const sender = {
  extensionId: 'test',
  url: 'https://www.linkedin.com/feed/',
  tabId: 1,
  frameId: 0,
};
const message = {
  protocolVersion: 1,
  requestId: 'test-request',
  type: 'GET_PUBLIC_STATUS',
};
describe('production unavailable broker', () => {
  it('rejects credential input and resume while allowing pause and clear', async () => {
    const fixture = createStorageBrowserFixture();
    const broadcast = vi.fn(async () => undefined);
    const { handle: broker } = createBroker({
      browser: { ...fixture.ports, broadcast },
      clock: fixture.clock,
      timeZone: 'UTC',
      extension,
    });
    const options = { ...sender, url: `${base}options.html` };
    expect(
      await broker(
        {
          ...message,
          type: 'SET_CREDENTIAL',
          provider: 'openai',
          credential: 'synthetic-key',
        },
        options,
      ),
    ).toMatchObject({ type: 'ERROR', error: { code: 'unsupported_provider' } });
    expect(fixture.snapshot().session).toEqual({});
    expect(
      await broker({ ...message, type: 'SET_ENABLED', enabled: true }, options),
    ).toMatchObject({ type: 'ERROR' });
    expect(
      await broker(
        { ...message, type: 'SET_ENABLED', enabled: false },
        options,
      ),
    ).toMatchObject({ type: 'ACK', enablementGeneration: 1 });
    expect(
      await broker({ ...message, type: 'CLEAR_DATA' }, options),
    ).toMatchObject({ type: 'ACK', enablementGeneration: 2 });
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESTORE_ALL', reason: 'data_cleared' }),
    );
    expect(await broker(message, sender)).toMatchObject({
      type: 'PUBLIC_STATUS',
      status: { enabled: false, state: 'unavailable' },
    });
  });
});
describe('sender isolation', () => {
  it('allows supported top-level feed status only', () => {
    expect(authorize(message, sender).surface).toBe('content');
    for (const altered of [
      { ...sender, frameId: 1 },
      { ...sender, extensionId: 'other' },
      { ...sender, url: 'https://www.linkedin.com/messaging/' },
    ]) {
      expect(authorize(message, altered).surface).toBe('rejected');
    }
    expect(authorize({ ...message, type: 'CLEAR_DATA' }, sender).surface).toBe(
      'rejected',
    );
  });
  it('separates popup pause and options privileges', () => {
    const popup = {
      ...sender,
      url: `${base}popup.html`,
      tabId: null,
      frameId: null,
    };
    expect(
      authorize({ ...message, type: 'SET_ENABLED', enabled: false }, popup)
        .surface,
    ).toBe('popup');
    expect(authorize({ ...message, type: 'CLEAR_DATA' }, popup).surface).toBe(
      'rejected',
    );
    expect(
      authorize(
        { ...message, type: 'CLEAR_DATA' },
        { ...popup, url: `${base}options.html` },
      ).surface,
    ).toBe('options');
  });
});
describe('bounded global scheduler', () => {
  it('deduplicates and invalidates late results after clear', async () => {
    const scheduler = schedulerFixture();
    let complete!: (result: ClassificationResult) => void;
    const run = vi.fn(
      () =>
        new Promise<ClassificationResult>((resolve) => {
          complete = resolve;
        }),
    );
    const first = scheduler.submit({
      key,
      owner: 'tab-1',
      requestId: 'tab-1',
      execute: run,
    });
    const second = scheduler.submit({
      key,
      owner: 'tab-2',
      requestId: 'tab-2',
      execute: run,
    });
    const results = Promise.allSettled([first, second]);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.invalidate();
    complete({} as ClassificationResult);
    expect(
      (await results).every((result) => result.status === 'rejected'),
    ).toBe(true);
  });
  it('bounds queue and global concurrency', async () => {
    const scheduler = schedulerFixture();
    const run = vi.fn(() => new Promise<ClassificationResult>(() => {}));
    const pending = Array.from({ length: 52 }, (_, i) =>
      scheduler
        .submit({
          key: { ...key, contentDigest: i.toString(16).padStart(64, '0') },
          owner: String(i),
          requestId: String(i),
          execute: run,
        })
        .catch(() => null),
    );
    await expect(
      scheduler.submit({
        key,
        owner: 'overflow',
        requestId: 'overflow',
        execute: run,
      }),
    ).rejects.toThrow('queue_full');
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.invalidate();
    await Promise.all(pending);
  });
});
