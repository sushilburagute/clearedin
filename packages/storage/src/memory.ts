import {
  ClassificationResultSchema,
  matchesProviderConfiguration,
  DiagnosticEventSchema,
  ExtractionCompletenessSchema,
  ModelIdSchema,
  ProviderIdSchema,
  VersionSchema,
  type ClassificationCache,
  type ClassificationCacheKey,
  type ClassificationResult,
  type Clock,
  type DiagnosticEvent,
  type DiagnosticsBuffer,
} from '@clearedin/contracts';

export const CACHE_TTL_MS = 30 * 60 * 1_000;
export const CACHE_MAX_ENTRIES = 500;
export const DIAGNOSTICS_MAX_EVENTS = 200;

export interface ClassificationCacheOptions {
  clock: Pick<Clock, 'now'>;
  /** Overrides may reduce, but cannot extend, the documented retention bounds. */
  ttlMs?: number;
  maxEntries?: number;
}

const KEY_FIELDS = [
  'provider',
  'model',
  'adapterVersion',
  'promptVersion',
  'taxonomyVersion',
  'contentDigest',
  'extraction',
  'extractorVersion',
] as const;

function keyString(key: ClassificationCacheKey): string | null {
  if (
    !key ||
    typeof key !== 'object' ||
    Object.keys(key).length !== KEY_FIELDS.length ||
    KEY_FIELDS.some((field) => !Object.hasOwn(key, field)) ||
    !ProviderIdSchema.safeParse(key.provider).success ||
    !ModelIdSchema.safeParse(key.model).success ||
    !VersionSchema.safeParse(key.adapterVersion).success ||
    !VersionSchema.safeParse(key.promptVersion).success ||
    !VersionSchema.safeParse(key.taxonomyVersion).success ||
    !VersionSchema.safeParse(key.extractorVersion).success ||
    !ExtractionCompletenessSchema.safeParse(key.extraction).success ||
    typeof key.contentDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(key.contentDigest)
  ) {
    return null;
  }
  // A tuple avoids concatenation collisions and ignores property insertion order.
  return JSON.stringify(KEY_FIELDS.map((field) => key[field]));
}

function boundedOption(value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new TypeError('Invalid memory retention limit.');
  }
  return value;
}

/**
 * Memory-only LRU cache. Reads do not extend the insertion TTL. Partial extraction
 * always misses; a complete cached response cannot authorize a partial post.
 * The runtime must rebind requestId for each subscriber and clear on provider/reset.
 */
export function createClassificationCache({
  clock,
  ttlMs = CACHE_TTL_MS,
  maxEntries = CACHE_MAX_ENTRIES,
}: ClassificationCacheOptions): ClassificationCache {
  boundedOption(ttlMs, CACHE_TTL_MS);
  boundedOption(maxEntries, CACHE_MAX_ENTRIES);
  const entries = new Map<
    string,
    { value: ClassificationResult; insertedAt: number }
  >();
  let lastTime = -1;

  function now(): number {
    const time = clock.now();
    if (!Number.isSafeInteger(time) || time < 0) {
      entries.clear();
      throw new TypeError('Invalid cache clock.');
    }
    // A wall-clock rollback must never extend browsing-derived retention.
    if (time < lastTime) entries.clear();
    lastTime = time;
    for (const [key, entry] of entries) {
      if (time - entry.insertedAt >= ttlMs) entries.delete(key);
    }
    return time;
  }

  return {
    get(key) {
      now();
      const serialized = keyString(key);
      if (serialized === null || key.extraction !== 'complete') return null;
      const entry = entries.get(serialized);
      if (!entry) return null;
      entries.delete(serialized);
      entries.set(serialized, entry);
      return structuredClone(entry.value);
    },
    set(key, value) {
      const time = now();
      const serialized = keyString(key);
      const parsed = ClassificationResultSchema.safeParse(value);
      if (
        serialized === null ||
        !parsed.success ||
        !matchesProviderConfiguration(parsed.data, key)
      ) {
        // Never include rejected payloads in exceptions or diagnostics.
        throw new TypeError('Invalid classification cache entry.');
      }
      if (key.extraction !== 'complete') return;
      entries.delete(serialized);
      entries.set(serialized, { value: parsed.data, insertedAt: time });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
    },
    clear() {
      entries.clear();
      lastTime = -1;
    },
  };
}

/** Session-memory ring only; the coordinator clears it on reset/disconnect. */
export function createDiagnosticsBuffer(): DiagnosticsBuffer {
  const events: DiagnosticEvent[] = [];
  return {
    append(event) {
      const parsed = DiagnosticEventSchema.safeParse(event);
      if (!parsed.success) throw new TypeError('Invalid diagnostic event.');
      events.push(parsed.data);
      if (events.length > DIAGNOSTICS_MAX_EVENTS) events.shift();
    },
    read() {
      return structuredClone(events);
    },
    clear() {
      events.length = 0;
    },
  };
}
