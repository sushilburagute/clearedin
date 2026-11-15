import {
  type ClassificationCacheKey,
  type ClassificationResult,
  type DiagnosticEvent,
} from '@clearedin/contracts';
import { describe, expect, it } from 'vitest';
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  DIAGNOSTICS_MAX_EVENTS,
  createClassificationCache,
  createDiagnosticsBuffer,
} from '../src/memory';

function key(index = 1): ClassificationCacheKey {
  return {
    contentDigest: index.toString(16).padStart(64, '0'),
    provider: 'typesafe',
    model: 'synthetic-model',
    adapterVersion: '1',
    taxonomyVersion: '1.0.0',
    promptVersion: '1',
    extractorVersion: '1',
    extraction: 'complete',
  };
}

function result(): ClassificationResult {
  return {
    schemaVersion: 1,
    requestId: 'synthetic-request',
    provider: 'typesafe',
    model: 'synthetic-model',
    adapterVersion: '1',
    taxonomyVersion: '1.0.0',
    promptVersion: '1',
    sufficiency: 'sufficient',
    categories: [
      { id: 'job_posting', score: 0.99, scoreKind: 'typed_membership' },
    ],
    abstention: null,
  };
}

function fixture() {
  let time = 1_000;
  const cache = createClassificationCache({ clock: { now: () => time } });
  return { cache, setTime: (next: number) => (time = next) };
}

describe('memory classification cache', () => {
  it('defensively copies writes and reads; callers rebind the original request ID', () => {
    const { cache } = fixture();
    const value = result();
    cache.set(key(), value);
    value.categories.length = 0;
    const first = cache.get(key());
    expect(first?.categories).toHaveLength(1);
    expect(first?.requestId).toBe('synthetic-request');
    if (first) first.categories.length = 0;
    expect(cache.get(key())?.categories).toHaveLength(1);
  });

  it('expires at 30 minutes and reads cannot extend retention', () => {
    const { cache, setTime } = fixture();
    cache.set(key(), result());
    setTime(1_000 + CACHE_TTL_MS - 1);
    expect(cache.get(key())).not.toBeNull();
    setTime(1_000 + CACHE_TTL_MS);
    expect(cache.get(key())).toBeNull();
  });

  it('evicts least recently used entries at the 500-entry limit', () => {
    const { cache } = fixture();
    for (let index = 1; index <= CACHE_MAX_ENTRIES; index++) {
      cache.set(key(index), result());
    }
    cache.get(key(1));
    cache.set(key(501), result());
    expect(cache.get(key(1))).not.toBeNull();
    expect(cache.get(key(2))).toBeNull();
    expect(cache.get(key(501))).not.toBeNull();
  });

  it('separates every namespace field, including extraction and extractor versions', () => {
    const { cache } = fixture();
    cache.set(key(), result());
    const changes: Partial<ClassificationCacheKey>[] = [
      { contentDigest: 'b'.repeat(64) },
      { provider: 'openai' },
      { model: 'other-model' },
      { adapterVersion: '2' },
      { taxonomyVersion: '2' },
      { promptVersion: '2' },
      { extractorVersion: '2' },
      { extraction: 'partial' },
    ];
    for (const change of changes)
      expect(cache.get({ ...key(), ...change })).toBeNull();
  });

  it('never caches a current partial extraction, even with a high-score result', () => {
    const { cache } = fixture();
    const partial = { ...key(), extraction: 'partial' as const };
    cache.set(partial, result());
    expect(cache.get(partial)).toBeNull();
    expect(cache.get(key())).toBeNull();
  });

  it('rejects mismatched metadata, invalid scores and raw-text fields with static errors', () => {
    const { cache } = fixture();
    expect(() => cache.set(key(), { ...result(), model: 'other' })).toThrow(
      'Invalid classification cache entry.',
    );
    const invalid = result();
    invalid.categories[0]!.score = Number.NaN;
    expect(() => cache.set(key(), invalid)).toThrow(
      'Invalid classification cache entry.',
    );
    const privatePayload = {
      ...result(),
      text: 'PRIVATE POST',
      credential: 'DUMMY SECRET',
    };
    expect(() => cache.set(key(), privatePayload)).toThrow(
      'Invalid classification cache entry.',
    );
    expect(cache.get(key())).toBeNull();
  });

  it('rejects extra key fields and malformed digests without retaining them', () => {
    const { cache } = fixture();
    const extra = { ...key(), text: 'PRIVATE POST' };
    expect(() => cache.set(extra, result())).toThrow(
      'Invalid classification cache entry.',
    );
    expect(cache.get(extra)).toBeNull();
    expect(() =>
      cache.set({ ...key(), contentDigest: 'raw text' }, result()),
    ).toThrow();
    expect(() =>
      cache.set({ ...key(), extractorVersion: '' }, result()),
    ).toThrow();
  });

  it('drops entries on clock rollback and resets immediately on clear', () => {
    const { cache, setTime } = fixture();
    cache.set(key(), result());
    setTime(500);
    expect(cache.get(key())).toBeNull();
    cache.set(key(), result());
    cache.clear();
    expect(cache.get(key())).toBeNull();
  });

  it('validates clock and retention options rather than allowing unbounded retention', () => {
    for (const ttlMs of [0, CACHE_TTL_MS + 1, Number.NaN]) {
      expect(() =>
        createClassificationCache({ clock: { now: () => 0 }, ttlMs }),
      ).toThrow();
    }
    expect(() =>
      createClassificationCache({ clock: { now: () => 0 }, maxEntries: 501 }),
    ).toThrow();
    const cache = createClassificationCache({
      clock: { now: () => Number.NaN },
    });
    expect(() => cache.get(key())).toThrow('Invalid cache clock.');
  });
});

describe('memory diagnostics', () => {
  it('retains only the last 200 events in insertion order and clears without persistence', () => {
    const buffer = createDiagnosticsBuffer();
    for (
      let timestamp = 0;
      timestamp < DIAGNOSTICS_MAX_EVENTS + 2;
      timestamp++
    ) {
      buffer.append({ timestamp, code: 'timeout' });
    }
    expect(buffer.read()).toHaveLength(200);
    expect(buffer.read()[0]?.timestamp).toBe(2);
    expect(buffer.read()[199]?.timestamp).toBe(201);
    buffer.clear();
    expect(buffer.read()).toEqual([]);
  });

  it('copies events on append and read', () => {
    const buffer = createDiagnosticsBuffer();
    const event: DiagnosticEvent = {
      timestamp: 1,
      code: 'timeout',
      provider: 'typesafe',
    };
    buffer.append(event);
    event.code = 'invalid_response';
    const first = buffer.read();
    expect(first[0]?.code).toBe('timeout');
    first[0]!.code = 'invalid_response';
    expect(buffer.read()[0]?.code).toBe('timeout');
  });

  it('rejects arbitrary fields and unsanitized codes without echoing their contents', () => {
    const buffer = createDiagnosticsBuffer();
    for (const field of [
      'text',
      'url',
      'contentDigest',
      'credential',
      'headers',
      'body',
    ]) {
      expect(() =>
        buffer.append({ timestamp: 1, code: 'timeout', [field]: 'PRIVATE' }),
      ).toThrow('Invalid diagnostic event.');
    }
    expect(() =>
      buffer.append({
        timestamp: 1,
        code: 'PRIVATE' as DiagnosticEvent['code'],
      }),
    ).toThrow('Invalid diagnostic event.');
    expect(buffer.read()).toEqual([]);
  });
});
