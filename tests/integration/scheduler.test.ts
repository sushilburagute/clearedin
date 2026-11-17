import { describe, expect, it, vi } from 'vitest';
import type {
  ClassificationCacheKey,
  ClassificationResult,
} from '@clearedin/contracts';
import { createClassificationCache } from '@clearedin/storage';
import { createStorageBrowserFixture } from '@clearedin/test-fixtures/storage';
import {
  createSyntheticClassifier,
  createSyntheticInput,
  SYNTHETIC_ADAPTER_VERSION,
  SYNTHETIC_MODEL,
  SYNTHETIC_PROMPT_VERSION,
} from '@clearedin/test-fixtures/fake-classifier';
import { createScheduler } from '../../apps/extension/src/background/scheduler';

const fixtureInput = createSyntheticInput('engagement-bait');
const key: ClassificationCacheKey = {
  provider: 'typesafe',
  model: SYNTHETIC_MODEL,
  adapterVersion: SYNTHETIC_ADAPTER_VERSION,
  promptVersion: SYNTHETIC_PROMPT_VERSION,
  taxonomyVersion: fixtureInput.taxonomyVersion,
  extraction: 'complete',
  extractorVersion: '1.0.0',
  contentDigest: 'a'.repeat(64),
};
const run = (signal: AbortSignal) =>
  createSyntheticClassifier().classify(fixtureInput, { signal });
function setup(options = {}) {
  const fixture = createStorageBrowserFixture();
  const cache = createClassificationCache({ clock: fixture.clock });
  return {
    fixture,
    cache,
    scheduler: createScheduler({ clock: fixture.clock, cache, ...options }),
  };
}

describe('global scheduler', () => {
  it('deduplicates cross-tab work, rebinds subscriber IDs, and serves the cache', async () => {
    const { scheduler } = setup();
    const execute = vi.fn(run);
    const [a, b] = await Promise.all(
      ['tab1', 'tab2'].map((owner) =>
        scheduler.submit({ owner, requestId: owner, key, execute }),
      ),
    );
    expect(a!.requestId).toBe('tab1');
    expect(b!.requestId).toBe('tab2');
    expect(execute).toHaveBeenCalledTimes(1);
    await scheduler.submit({ owner: 'tab3', requestId: 'cache', key, execute });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(scheduler.size()).toEqual({ active: 0, queued: 0, subscribers: 0 });
  });
  it('cancelling one subscriber leaves the other active', async () => {
    const { scheduler } = setup();
    const a = scheduler.submit({
      owner: 'a',
      requestId: 'a',
      key,
      execute: run,
    });
    const b = scheduler.submit({
      owner: 'b',
      requestId: 'b',
      key,
      execute: run,
    });
    const rejected = expect(a).rejects.toThrow('cancelled');
    scheduler.cancel('a');
    await rejected;
    expect((await b).requestId).toBe('b');
  });
  it('enforces capacity and logical deadlines including queued time', async () => {
    const { scheduler, fixture } = setup({ concurrency: 1, queueCap: 1 });
    const execute = vi.fn(() => new Promise<ClassificationResult>(() => {}));
    const a = scheduler.submit({ owner: 'a', requestId: 'a', key, execute });
    const b = scheduler.submit({
      owner: 'b',
      requestId: 'b',
      key: { ...key, contentDigest: 'b'.repeat(64) },
      execute,
    });
    const outcomes = Promise.allSettled([a, b]);
    await expect(
      scheduler.submit({
        owner: 'c',
        requestId: 'c',
        key: { ...key, contentDigest: 'c'.repeat(64) },
        execute,
      }),
    ).rejects.toThrow('queue_full');
    expect(execute).toHaveBeenCalledTimes(1);
    fixture.advance(10_000);
    expect((await outcomes).map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    expect(scheduler.size().subscribers).toBe(0);
  });
  it('invalidates queued work and ignores late results after pause/reset', async () => {
    const { scheduler, cache } = setup({ concurrency: 1 });
    let finish!: (result: ClassificationResult) => void;
    const a = scheduler.submit({
      owner: 'a',
      requestId: 'a',
      key,
      execute: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });
    const queued = vi.fn(run);
    const b = scheduler.submit({
      owner: 'b',
      requestId: 'b',
      key: { ...key, extractorVersion: '2.0.0' },
      execute: queued,
    });
    const outcomes = Promise.allSettled([a, b]);
    await Promise.resolve();
    scheduler.invalidate();
    finish(await run(new AbortController().signal));
    await outcomes;
    expect(queued).not.toHaveBeenCalled();
    expect(cache.get(key)).toBeNull();
    expect(scheduler.size()).toEqual({ active: 0, queued: 0, subscribers: 0 });
  });
  it('never reuses complete extraction for partial text or another extractor', async () => {
    const { scheduler } = setup();
    const execute = vi.fn(run);
    for (const variant of [
      key,
      { ...key, extraction: 'partial' as const },
      { ...key, extractorVersion: '2.0.0' },
    ])
      await scheduler.submit({
        owner: 'a',
        requestId: 'a',
        key: variant,
        execute,
      });
    expect(execute).toHaveBeenCalledTimes(3);
  });
  it('rejects wrong-version results without caching them', async () => {
    const { scheduler, cache } = setup();
    await expect(
      scheduler.submit({
        owner: 'a',
        requestId: 'a',
        key,
        execute: async (signal) => ({ ...(await run(signal)), model: 'wrong' }),
      }),
    ).rejects.toThrow();
    expect(cache.get(key)).toBeNull();
  });
});
