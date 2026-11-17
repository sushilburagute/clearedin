import {
  ClassificationResultSchema,
  type ClassificationCacheKey,
  type ClassificationInput,
  type ClassifierAdapter,
  type ExtractedPost,
  type ProviderConfiguration,
} from '@clearedin/contracts';
import type { Storage } from '@clearedin/storage';

/** Recompute from bounded text; caller-provided digests cannot poison another tab's cache. */
export async function cacheIdentity(
  post: ExtractedPost,
  configuration: ProviderConfiguration,
): Promise<ClassificationCacheKey> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(post.text),
  );
  return {
    ...configuration,
    extraction: post.extraction,
    extractorVersion: post.extractorVersion,
    contentDigest: Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(''),
  };
}

/** Injectable dispatch seam; production registry intentionally never calls this yet. */
export async function dispatchReserved(input: {
  storage: Storage;
  adapter: ClassifierAdapter;
  configuration: ProviderConfiguration;
  classification: ClassificationInput;
  expectedGeneration: number;
  credential: string;
  signal: AbortSignal;
}) {
  const { storage, configuration, classification, expectedGeneration, signal } =
    input;
  const current = async () => {
    const snapshot = await storage.settings.read();
    if (signal.aborted || snapshot.enablementGeneration !== expectedGeneration)
      throw new Error('cancelled');
    const settings = snapshot.settings;
    if (
      !settings.enabled ||
      settings.consent?.status !== 'granted' ||
      settings.provider !== configuration.provider ||
      settings.model !== configuration.model
    )
      throw new Error('not_enabled');
    return settings;
  };
  const settings = await current();
  if (
    input.adapter.id !== configuration.provider ||
    classification.taxonomyVersion !== configuration.taxonomyVersion ||
    classification.promptVersion !== configuration.promptVersion
  )
    throw new Error('invalid_request');
  const reservation = await storage.usage.reserve({
    requestId: classification.requestId,
    provider: configuration.provider,
    expectedGeneration,
    dailyRequestLimit: settings.dailyRequestLimit,
    estimatedCostCap: settings.estimatedCostCap,
    requestCostEstimate: null,
  });
  if (!reservation.accepted) throw new Error(reservation.error.code);
  // A cancelled reservation stays charged conservatively, including worker interruption.
  await current();
  const result = ClassificationResultSchema.parse(
    await input.adapter.classify(classification, {
      model: configuration.model,
      credential: input.credential,
      signal,
    }),
  );
  await current();
  if (
    result.requestId !== classification.requestId ||
    result.provider !== configuration.provider ||
    result.model !== configuration.model ||
    result.adapterVersion !== configuration.adapterVersion ||
    result.taxonomyVersion !== configuration.taxonomyVersion ||
    result.promptVersion !== configuration.promptVersion
  )
    throw new Error('invalid_response');
  await storage.usage.reconcile(
    classification.requestId,
    result.usage ?? null,
    expectedGeneration,
  );
  await current();
  return result;
}
