import { expect, it, vi } from 'vitest';
import {
  cacheIdentity,
  dispatchReserved,
} from '../../apps/extension/src/background/dispatch';
import { harness } from '../../packages/storage/tests/helpers';
import type { ClassificationResult } from '@clearedin/contracts';

const configuration = {
  provider: 'openai' as const,
  model: 'synthetic',
  adapterVersion: '1',
  taxonomyVersion: '1',
  promptVersion: '1',
};
it('computes complete cache identity independently of untrusted digest', async () => {
  const post = {
    text: 'synthetic',
    extraction: 'complete' as const,
    extractorVersion: '1',
    localSponsored: false,
    identity: {
      postId: 'post',
      contentDigest: '0'.repeat(64),
      nodeGeneration: 0,
    },
  };
  const key = await cacheIdentity(post, configuration);
  expect(key.contentDigest).not.toBe(post.identity.contentDigest);
  expect(
    await cacheIdentity({ ...post, extraction: 'partial' }, configuration),
  ).not.toEqual(key);
});
it('reserves before dispatch, rejects stale completion and retains accounting across restart', async () => {
  const fixture = harness();
  const initial = await fixture.storage.settings.read();
  const selected = await fixture.storage.settings.write(
    { ...initial.settings, provider: 'openai', model: 'synthetic' },
    initial.enablementGeneration,
  );
  const enabled = await fixture.storage.settings.write(
    {
      ...selected.settings,
      enabled: true,
      consent: {
        provider: 'openai',
        version: '1',
        recipientId: 'openai',
        dataClasses: ['post_text', 'classification_instructions'],
        timestamp: 1,
        status: 'granted',
      },
    },
    selected.enablementGeneration,
  );
  const classify = vi.fn(async (): Promise<ClassificationResult> => {
    expect((await fixture.storage.usage.read()).attempts).toBe(1);
    await fixture.storage.settings.invalidate(enabled.enablementGeneration);
    return {
      ...configuration,
      requestId: 'attempt-one',
      schemaVersion: 1,
      sufficiency: 'sufficient',
      categories: [],
      abstention: null,
    };
  });
  await expect(
    dispatchReserved({
      storage: fixture.storage,
      adapter: { id: 'openai', classify },
      configuration,
      classification: {
        requestId: 'attempt-one',
        text: 'synthetic',
        extraction: 'complete',
        taxonomyVersion: '1',
        promptVersion: '1',
      },
      expectedGeneration: enabled.enablementGeneration,
      credential: 'synthetic',
      signal: new AbortController().signal,
    }),
  ).rejects.toThrow('cancelled');
  expect(classify).toHaveBeenCalledTimes(1);
  expect((await fixture.restart().usage.read()).attempts).toBe(1);
});
