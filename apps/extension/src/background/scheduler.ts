import type { ClassificationResult } from '@clearedin/contracts';

type Subscriber = {
  resolve(value: ClassificationResult): void;
  reject(error: Error): void;
};
type Job = {
  key: string;
  controller: AbortController;
  subscribers: Map<string, Subscriber>;
  run(signal: AbortSignal): Promise<ClassificationResult>;
  timer: ReturnType<typeof setTimeout>;
};

/** Single background instance. Dispatch must reserve durable usage before every attempt.
 * Keys must include digest, extraction, extractor and every provider configuration version.
 * No automatic retries: uncertain billing must never be silently repeated.
 */
export class Scheduler {
  private jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private active = 0;

  submit(
    key: string,
    subscriber: string,
    run: Job['run'],
  ): Promise<ClassificationResult> {
    let job = this.jobs.get(key);
    if (!job && this.queue.length >= 50)
      return Promise.reject(new Error('queue_full'));
    if (job?.subscribers.has(subscriber))
      return Promise.reject(new Error('invalid_request'));
    if (job && job.subscribers.size >= 100)
      return Promise.reject(new Error('queue_full'));
    const promise = new Promise<ClassificationResult>((resolve, reject) => {
      if (!job) {
        job = {
          key,
          controller: new AbortController(),
          subscribers: new Map(),
          run,
          timer: setTimeout(
            () => this.finish(job!, new Error('timeout')),
            10_000,
          ),
        };
        this.jobs.set(key, job);
        this.queue.push(job);
      }
      job.subscribers.set(subscriber, { resolve, reject });
    });
    this.pump();
    return promise;
  }

  cancel(subscriber: string) {
    for (const job of this.jobs.values()) {
      job.subscribers.get(subscriber)?.reject(new Error('cancelled'));
      job.subscribers.delete(subscriber);
      if (!job.subscribers.size) this.finish(job, new Error('cancelled'));
    }
  }

  clear() {
    for (const job of [...this.jobs.values()])
      this.finish(job, new Error('cancelled'));
  }

  private finish(job: Job, error?: Error, result?: ClassificationResult) {
    if (this.jobs.get(job.key) !== job) return;
    this.jobs.delete(job.key);
    this.queue = this.queue.filter((queued) => queued !== job);
    clearTimeout(job.timer);
    job.controller.abort();
    for (const subscriber of job.subscribers.values()) {
      if (error) subscriber.reject(error);
      else subscriber.resolve(result!);
    }
    job.subscribers.clear();
  }

  private pump() {
    while (this.active < 2 && this.queue.length) {
      const job = this.queue.shift()!;
      this.active++;
      // Keep the physical concurrency slot until an abort-ignoring adapter settles.
      Promise.resolve()
        .then(() => {
          if (job.controller.signal.aborted) throw new Error('cancelled');
          return job.run(job.controller.signal);
        })
        .then(
          (result) => this.finish(job, undefined, result),
          () => this.finish(job, new Error('provider_unavailable')),
        )
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}
