import {
  ExtractedPostSchema,
  ClassificationResultSchema,
  type ClassificationInput,
  type ClassificationResult,
  type Clock,
  type ExtractedPost,
  type MoneyAmount,
  type ProviderConfiguration,
} from '@clearedin/contracts';
import type { Storage } from '@clearedin/storage';
import { createScheduler } from './scheduler';

/** Injected inference boundary. Production entrypoints do not instantiate this
 * until provider/browser/credential gates are accepted. Tests use synthetic data. */
export function createClassificationCoordinator(input: {
  storage: Storage;
  clock: Clock;
  configuration: ProviderConfiguration;
  consentVersion: string;
  recipientId: string;
  isAvailable(): Promise<boolean>;
  digest(text: string): Promise<string>;
  attemptId(): string;
  estimate(post: ExtractedPost): MoneyAmount | null;
  classify(
    request: ClassificationInput,
    signal: AbortSignal,
  ): Promise<ClassificationResult>;
}) {
  const scheduler = createScheduler({
    clock: input.clock,
    cache: input.storage.cache,
  });
  let epoch = 0;
  let failures = 0;
  let blockedUntil = 0;
  const pending = new Map<string, AbortController>();
  async function check(
    generation: number,
    captured: number,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    if (captured !== epoch) throw new Error('cancelled');
    const snapshot = await input.storage.settings.read();
    if (snapshot.enablementGeneration !== generation)
      throw new Error('cancelled');
    const settings = snapshot.settings;
    if (!settings.enabled) throw new Error('not_enabled');
    const consent = settings.consent;
    if (
      settings.provider !== input.configuration.provider ||
      settings.model !== input.configuration.model
    )
      throw new Error('unsupported_provider');
    if (
      !consent ||
      consent.status !== 'granted' ||
      consent.version !== input.consentVersion ||
      consent.provider !== settings.provider ||
      consent.recipientId !== input.recipientId ||
      !consent.dataClasses.includes('post_text') ||
      !consent.dataClasses.includes('classification_instructions')
    )
      throw new Error('consent_required');
    if (!(await input.isAvailable())) throw new Error('provider_unavailable');
    signal?.throwIfAborted();
    if (captured !== epoch) throw new Error('cancelled');
    return settings;
  }
  return {
    async classify(
      owner: string,
      requestId: string,
      rawPost: ExtractedPost,
      generation: number,
    ) {
      pending.get(owner)?.abort();
      scheduler.cancel(owner);
      if (pending.size >= 100 && !pending.has(owner))
        throw new Error('queue_full');
      const admission = new AbortController();
      pending.set(owner, admission);
      const captured = epoch;
      let post: ExtractedPost;
      let contentDigest: string;
      try {
        post = ExtractedPostSchema.parse(rawPost);
        await check(generation, captured, admission.signal);
        if (post.extraction !== 'complete') throw new Error('invalid_request');
        // The DOM identity digest also includes local disclosure/repost state.
        // Cache inference by independently hashed minimized text, not that digest.
        contentDigest = await input.digest(post.text);
        if (!/^[a-f0-9]{64}$/.test(contentDigest))
          throw new Error('invalid_request');
        await check(generation, captured, admission.signal);
      } finally {
        if (pending.get(owner) === admission) pending.delete(owner);
      }
      const result = await scheduler.submit({
        owner,
        requestId,
        key: {
          ...input.configuration,
          contentDigest,
          extraction: post.extraction,
          extractorVersion: post.extractorVersion,
        },
        async execute(signal) {
          const settings = await check(generation, captured, signal);
          if (input.clock.now() < blockedUntil)
            throw new Error('provider_unavailable');
          const attemptId = input.attemptId();
          const reservation = await input.storage.usage.reserve({
            requestId: attemptId,
            provider: input.configuration.provider,
            expectedGeneration: generation,
            dailyRequestLimit: settings.dailyRequestLimit,
            estimatedCostCap: settings.estimatedCostCap,
            requestCostEstimate: input.estimate(post),
          });
          if (!reservation.accepted) throw new Error(reservation.error.code);
          // A pause/withdrawal can happen while durable accounting is being written.
          await check(generation, captured, signal);
          try {
            const answer = ClassificationResultSchema.parse(
              await input.classify(
                {
                  requestId: attemptId,
                  text: post.text,
                  extraction: post.extraction,
                  taxonomyVersion: input.configuration.taxonomyVersion,
                  promptVersion: input.configuration.promptVersion,
                },
                signal,
              ),
            );
            if (answer.requestId !== attemptId)
              throw new Error('invalid_response');
            await check(generation, captured, signal);
            await input.storage.usage.reconcile(
              attemptId,
              answer.usage ?? null,
              generation,
            );
            failures = 0;
            return answer;
          } catch (error) {
            if (!signal.aborted && captured === epoch && ++failures >= 3)
              blockedUntil = input.clock.now() + 30_000;
            throw error;
          }
        },
      });
      await check(generation, captured);
      return result;
    },
    cancel(owner: string) {
      pending.get(owner)?.abort();
      pending.delete(owner);
      scheduler.cancel(owner);
    },
    invalidate() {
      ++epoch;
      for (const admission of pending.values()) admission.abort();
      pending.clear();
      scheduler.invalidate();
      failures = 0;
      blockedUntil = 0;
    },
    size: scheduler.size,
  };
}
