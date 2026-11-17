import { describe, expect, it, vi } from 'vitest';
import { authorize } from '../../apps/extension/src/messaging/authorize';
import { Scheduler } from '../../apps/extension/src/background/scheduler';
import type { ClassificationResult } from '@clearedin/contracts';
import { harness } from '../../packages/storage/tests/helpers';
import { createBroker } from '../../apps/extension/src/background/broker';

const base = 'chrome-extension://test/';
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
    const { storage, session } = harness();
    const broadcast = vi.fn(async () => undefined);
    const broker = createBroker(storage, 'test', base, broadcast);
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
    ).toMatchObject({ type: 'ERROR', error: { code: 'provider_unavailable' } });
    expect(session.values.size).toBe(0);
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
    expect(authorize(message, sender, 'test', base).surface).toBe('content');
    for (const altered of [
      { ...sender, frameId: 1 },
      { ...sender, extensionId: 'other' },
      { ...sender, url: 'https://www.linkedin.com/messaging/' },
    ]) {
      expect(authorize(message, altered, 'test', base).surface).toBe(
        'rejected',
      );
    }
    expect(
      authorize({ ...message, type: 'CLEAR_DATA' }, sender, 'test', base)
        .surface,
    ).toBe('rejected');
  });
  it('separates popup pause and options privileges', () => {
    const popup = {
      ...sender,
      url: `${base}popup.html`,
      tabId: null,
      frameId: null,
    };
    expect(
      authorize(
        { ...message, type: 'SET_ENABLED', enabled: false },
        popup,
        'test',
        base,
      ).surface,
    ).toBe('popup');
    expect(
      authorize({ ...message, type: 'CLEAR_DATA' }, popup, 'test', base)
        .surface,
    ).toBe('rejected');
    expect(
      authorize(
        { ...message, type: 'CLEAR_DATA' },
        { ...popup, url: `${base}options.html` },
        'test',
        base,
      ).surface,
    ).toBe('options');
  });
});
describe('bounded global scheduler', () => {
  it('deduplicates and invalidates late results after clear', async () => {
    const scheduler = new Scheduler();
    let complete!: (result: ClassificationResult) => void;
    const run = vi.fn(
      () =>
        new Promise<ClassificationResult>((resolve) => {
          complete = resolve;
        }),
    );
    const first = scheduler.submit('complete-key', 'tab-1', run);
    const second = scheduler.submit('complete-key', 'tab-2', run);
    const results = Promise.allSettled([first, second]);
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    scheduler.clear();
    complete({} as ClassificationResult);
    expect(
      (await results).every((result) => result.status === 'rejected'),
    ).toBe(true);
  });
  it('bounds queue and global concurrency', async () => {
    const scheduler = new Scheduler();
    const run = vi.fn(() => new Promise<ClassificationResult>(() => {}));
    const pending = Array.from({ length: 52 }, (_, i) =>
      scheduler.submit(String(i), String(i), run).catch(() => null),
    );
    await expect(scheduler.submit('overflow', 'overflow', run)).rejects.toThrow(
      'queue_full',
    );
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.clear();
    await Promise.all(pending);
  });
});
