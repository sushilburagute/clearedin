import {
  ClassificationResultSchema,
  matchesProviderConfiguration,
  ErrorCodeSchema,
  type ClassificationCacheKey,
  type ClassificationResult,
  type Clock,
  type ClassificationCache,
} from '@clearedin/contracts';

interface Subscriber {
  resolve(result: ClassificationResult): void;
  reject(error: Error): void;
  requestId: string;
}
interface Job {
  key: ClassificationCacheKey;
  controller: AbortController;
  subscribers: Map<string, Subscriber>;
  execute(signal: AbortSignal): Promise<ClassificationResult>;
  stopDeadline(): void;
  active: boolean;
  done: boolean;
}

/** One instance per background, all tabs. Cache stores classifications, never decisions. */
export function createScheduler(input: {
  clock: Clock;
  cache: ClassificationCache;
  concurrency?: number;
  queueCap?: number;
  deadlineMs?: number;
}) {
  const concurrency = input.concurrency ?? 2;
  const queueCap = input.queueCap ?? 50;
  const deadline = input.deadlineMs ?? 10_000;
  if (
    ![concurrency, queueCap, deadline].every(
      (value) => Number.isSafeInteger(value) && value > 0,
    )
  )
    throw new Error('invalid_request');
  const jobs = new Map<string, Job>();
  const owners = new Map<string, Job>();
  let active = 0;
  const keyOf = (key: ClassificationCacheKey) =>
    JSON.stringify([
      key.contentDigest,
      key.extraction,
      key.extractorVersion,
      key.taxonomyVersion,
      key.promptVersion,
      key.provider,
      key.model,
      key.adapterVersion,
    ]);

  function finish(
    job: Job,
    result: ClassificationResult | null,
    error: Error | null,
  ) {
    if (job.done) return;
    if (result) {
      try {
        input.cache.set(job.key, result);
      } catch {
        result = null;
        error = new Error('invalid_response');
      }
    }
    job.done = true;
    job.stopDeadline();
    jobs.delete(keyOf(job.key));
    if (job.active) --active;
    for (const [owner, subscriber] of job.subscribers) {
      owners.delete(owner);
      if (result)
        subscriber.resolve({ ...result, requestId: subscriber.requestId });
      else subscriber.reject(error ?? new Error('cancelled'));
    }
    job.subscribers.clear();
    job.controller.abort();
    pump();
  }

  function pump() {
    for (const job of jobs.values()) {
      if (active >= concurrency) break;
      if (job.active || job.done) continue;
      job.active = true;
      ++active;
      void Promise.resolve()
        .then(() => {
          job.controller.signal.throwIfAborted();
          return job.execute(job.controller.signal);
        })
        .then((raw) => {
          if (job.done) return;
          const result = ClassificationResultSchema.parse(raw);
          if (!matchesProviderConfiguration(result, job.key))
            throw new Error('invalid_response');
          finish(job, result, null);
        })
        .catch((error) => {
          const code = ErrorCodeSchema.safeParse(
            error instanceof Error ? error.message : null,
          );
          finish(
            job,
            null,
            new Error(
              job.controller.signal.aborted
                ? 'cancelled'
                : code.success
                  ? code.data
                  : 'provider_unavailable',
            ),
          );
        });
    }
  }

  function cancel(owner: string) {
    const job = owners.get(owner);
    const subscriber = job?.subscribers.get(owner);
    if (!job || !subscriber) return;
    owners.delete(owner);
    job.subscribers.delete(owner);
    subscriber.reject(new Error('cancelled'));
    if (!job.subscribers.size) finish(job, null, new Error('cancelled'));
  }

  return {
    submit(request: {
      owner: string;
      requestId: string;
      key: ClassificationCacheKey;
      execute(signal: AbortSignal): Promise<ClassificationResult>;
    }): Promise<ClassificationResult> {
      // Reusing a subscriber identifier cancels its earlier subscription only.
      cancel(request.owner);
      const cached = input.cache.get(request.key);
      if (cached)
        return Promise.resolve({ ...cached, requestId: request.requestId });
      const key = keyOf(request.key);
      let job = jobs.get(key);
      if (!job && jobs.size >= concurrency + queueCap)
        return Promise.reject(new Error('queue_full'));
      if (job && job.subscribers.size >= 100)
        return Promise.reject(new Error('queue_full'));
      if (!job) {
        job = {
          key: { ...request.key },
          controller: new AbortController(),
          subscribers: new Map(),
          execute: request.execute,
          stopDeadline: () => {},
          active: false,
          done: false,
        };
        const scheduled = job;
        jobs.set(key, job);
        job.stopDeadline = input.clock.schedule(
          () => finish(scheduled, null, new Error('timeout')),
          deadline,
        );
      }
      const target = job;
      const result = new Promise<ClassificationResult>((resolve, reject) => {
        target.subscribers.set(request.owner, {
          resolve,
          reject,
          requestId: request.requestId,
        });
        owners.set(request.owner, target);
      });
      pump();
      return result;
    },
    cancel,
    invalidate() {
      // Detach the entire queue before finishing so no queued request dispatches.
      const pending = [...jobs.values()];
      jobs.clear();
      for (const job of pending) finish(job, null, new Error('cancelled'));
      input.cache.clear();
    },
    size: () => ({
      active,
      queued: jobs.size - active,
      subscribers: owners.size,
    }),
  };
}
