import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { ExtractedPost } from '@clearedin/contracts';
import { createStorage } from '@clearedin/storage';
import { createStorageBrowserFixture } from '@clearedin/test-fixtures/storage';
import {
  createSyntheticClassifier,
  createSyntheticInput,
  SYNTHETIC_ADAPTER_VERSION,
  SYNTHETIC_MODEL,
  SYNTHETIC_PROMPT_VERSION,
} from '@clearedin/test-fixtures/fake-classifier';
import { createClassificationCoordinator } from '../../apps/extension/src/background/coordinator';

const digest = async (text: string) =>
  createHash('sha256').update(text).digest('hex');
async function setup() {
  const fixture = createStorageBrowserFixture();
  const storage = createStorage({
    browser: fixture.ports,
    clock: fixture.clock,
    timeZone: 'UTC',
  });
  const initial = await storage.settings.read();
  const selected = await storage.settings.write(
    { ...initial.settings, provider: 'typesafe', model: SYNTHETIC_MODEL },
    0,
  );
  const enabled = await storage.settings.write(
    {
      ...selected.settings,
      enabled: true,
      dailyRequestLimit: 1,
      consent: {
        version: '1',
        provider: 'typesafe',
        recipientId: 'synthetic',
        dataClasses: ['post_text', 'classification_instructions'],
        timestamp: fixture.clock.now(),
        status: 'granted',
      },
    },
    selected.enablementGeneration,
  );
  const sample = createSyntheticInput('engagement-bait');
  const post: ExtractedPost = {
    identity: {
      postId: 'synthetic',
      contentDigest: await digest(sample.text),
      nodeGeneration: 0,
    },
    text: sample.text,
    extraction: sample.extraction,
    extractorVersion: '1',
    localSponsored: false,
  };
  const classify = vi.fn((request, signal) =>
    createSyntheticClassifier().classify(request, { signal }),
  );
  let attempts = 0;
  const make = () =>
    createClassificationCoordinator({
      storage,
      clock: fixture.clock,
      configuration: {
        provider: 'typesafe',
        model: SYNTHETIC_MODEL,
        adapterVersion: SYNTHETIC_ADAPTER_VERSION,
        promptVersion: SYNTHETIC_PROMPT_VERSION,
        taxonomyVersion: sample.taxonomyVersion,
      },
      consentVersion: '1',
      recipientId: 'synthetic',
      isAvailable: async () => true,
      digest,
      attemptId: () => `attempt-${++attempts}`,
      estimate: () => null,
      classify,
    });
  return {
    fixture,
    storage,
    coordinator: make(),
    make,
    post,
    classify,
    generation: enabled.enablementGeneration,
  };
}

describe('classification coordinator with synthetic inference', () => {
  it('deduplicates tabs into one durable attempt and reuses the cache', async () => {
    const { coordinator, storage, post, classify, generation } = await setup();
    const results = await Promise.all(
      ['tab1', 'tab2'].map((owner) =>
        coordinator.classify(owner, owner, post, generation),
      ),
    );
    expect(results.map((result) => result.requestId)).toEqual(['tab1', 'tab2']);
    expect(classify).toHaveBeenCalledTimes(1);
    expect((await storage.usage.read()).attempts).toBe(1);
    await coordinator.classify('tab3', 'cached', post, generation);
    expect(classify).toHaveBeenCalledTimes(1);
  });
  it('enforces the durable daily limit after the memory cache is lost', async () => {
    const { coordinator, make, post, generation, classify } = await setup();
    await coordinator.classify('tab1', 'first', post, generation);
    coordinator.invalidate();
    await expect(
      make().classify('tab1', 'second', post, generation),
    ).rejects.toThrow();
    expect(classify).toHaveBeenCalledTimes(1);
  });
  it('does not dispatch after consent withdrawal or accept cached results', async () => {
    const { coordinator, storage, post, generation, classify } = await setup();
    const saved = await storage.settings.read();
    await storage.settings.write(
      { ...saved.settings, enabled: false, consent: null },
      generation,
    );
    await expect(
      coordinator.classify('tab1', 'late', post, generation),
    ).rejects.toThrow('cancelled');
    expect(classify).not.toHaveBeenCalled();
  });
  it('rejects incomplete extraction before reserving', async () => {
    const { coordinator, storage, post, generation } = await setup();
    for (const invalid of [{ ...post, extraction: 'partial' as const }])
      await expect(
        coordinator.classify('tab1', 'bad', invalid, generation),
      ).rejects.toThrow('invalid_request');
    expect((await storage.usage.read()).attempts).toBe(0);
  });
  it('retains a conservative reservation for an unsuccessful inference', async () => {
    const { coordinator, storage, post, generation, classify } = await setup();
    classify.mockRejectedValueOnce(new Error('private provider body'));
    await expect(
      coordinator.classify('tab1', 'failed', post, generation),
    ).rejects.toThrow('provider_unavailable');
    expect((await storage.usage.read()).attempts).toBe(1);
  });
  it('rejects a mismatched classification before settling the reserved cost', async () => {
    const { coordinator, storage, post, generation, classify } = await setup();
    classify.mockImplementationOnce(async (request, signal) => ({
      ...(await createSyntheticClassifier().classify(request, { signal })),
      model: 'different-model',
      usage: { estimatedCost: 0, currency: 'USD' },
    }));
    await expect(
      coordinator.classify('tab', 'mismatch', post, generation),
    ).rejects.toThrow('invalid_response');
    expect(await storage.usage.read()).toMatchObject({
      attempts: 1,
      estimatedCost: null,
    });
  });
  it('hashes text independently instead of trusting local identity for cache hits', async () => {
    const { coordinator, storage, post, generation, classify } = await setup();
    const snapshot = await storage.settings.read();
    await storage.settings.write(
      { ...snapshot.settings, dailyRequestLimit: 2 },
      generation,
    );
    const first = await coordinator.classify('one', 'one', post, generation);
    const other = createSyntheticInput('motivational-story');
    const second = await coordinator.classify(
      'two',
      'two',
      { ...post, text: other.text },
      generation,
    );
    expect(first.categories[0]!.id).toBe('engagement_bait');
    expect(second.categories[0]!.id).toBe('motivational_story');
    expect(classify).toHaveBeenCalledTimes(2);
  });
  it('cancels before asynchronous admission can enqueue any work', async () => {
    const { coordinator, storage, post, generation, classify } = await setup();
    const pending = coordinator.classify('tab1', 'early', post, generation);
    coordinator.cancel('tab1');
    await expect(pending).rejects.toThrow();
    expect(classify).not.toHaveBeenCalled();
    expect((await storage.usage.read()).attempts).toBe(0);
  });
});
