import { describe, expect, it } from 'vitest';
import { USAGE_KEY, createStorage } from '../src';
import { attempt, harness } from './helpers';

const dollars = (amount: number) => ({ amount, currency: 'USD' });
describe('durable request accounting', () => {
  it('serializes racing reservations across callers and facades', async () => {
    const fixture = harness();
    const second = createStorage({
      browser: fixture.browser,
      clock: fixture.clock,
      timeZone: 'UTC',
    });
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, index) =>
        (index % 2 ? second : fixture.storage).usage.reserve(
          attempt(`request-${index}`),
        ),
      ),
    );
    expect(results.filter((result) => result.accepted)).toHaveLength(2);
    expect((await fixture.storage.usage.read()).attempts).toBe(2);
    expect(
      ((await fixture.local.get(USAGE_KEY)) as { entries: unknown[] }).entries,
    ).toHaveLength(2);
  });
  it('retains unresolved, failed and token-only attempts through worker restart', async () => {
    const fixture = harness();
    await fixture.storage.usage.reserve(attempt('unresolved'));
    await fixture.storage.usage.reserve(attempt('failed'));
    await fixture.storage.usage.reconcile('failed', null, 0);
    await fixture.storage.usage.reconcile('unresolved', { inputTokens: 42 }, 0);
    const fresh = fixture.restart();
    expect((await fresh.usage.read()).attempts).toBe(2);
    expect(await fresh.usage.reserve(attempt('retry'))).toEqual({
      accepted: false,
      error: { code: 'daily_limit', retryable: false },
    });
  });
  it('charges retries separately and rejects duplicate identifiers', async () => {
    const { storage } = harness();
    expect((await storage.usage.reserve(attempt('original'))).accepted).toBe(
      true,
    );
    expect((await storage.usage.reserve(attempt('original'))).accepted).toBe(
      false,
    );
    expect((await storage.usage.reserve(attempt('retry'))).accepted).toBe(true);
    expect((await storage.usage.read()).attempts).toBe(2);
  });
  it('never authorizes dispatch on failed persistence and poisons ambiguous state', async () => {
    const { storage, local } = harness();
    local.failWrite = true;
    await expect(storage.usage.reserve(attempt('failure'))).rejects.toThrow(
      'storage_unavailable',
    );
    local.failWrite = false;
    await expect(storage.usage.reserve(attempt('later'))).rejects.toThrow(
      'storage_unavailable',
    );
  });
  it('rolls forward once, tolerates rollback/restart, retains only current and prior calendar day', async () => {
    const fixture = harness();
    await fixture.storage.usage.reserve(attempt('day16'));
    fixture.setNow('2026-11-17T00:00:00Z');
    await fixture.storage.usage.reserve(attempt('day17'));
    fixture.setNow('2026-11-16T12:00:00Z');
    const restarted = fixture.restart();
    expect((await restarted.usage.read()).accountingDay).toBe('2026-11-17');
    expect((await restarted.usage.read()).attempts).toBe(1);
    fixture.setNow('2026-11-18T01:00:00Z');
    expect((await restarted.usage.read()).attempts).toBe(0);
    const ledger = (await fixture.local.get(USAGE_KEY)) as {
      entries: { requestId: string }[];
    };
    expect(ledger.entries.map((entry) => entry.requestId)).toEqual(['day17']);
  });
  it('persists the watermark even when a request is refused', async () => {
    const fixture = harness();
    fixture.setNow('2026-11-20T00:00:00Z');
    await fixture.storage.usage.reserve(
      attempt('unknown-price', { estimatedCostCap: dollars(1) }),
    );
    fixture.setNow('2026-11-16T12:00:00Z');
    expect((await fixture.restart().usage.read()).accountingDay).toBe(
      '2026-11-20',
    );
  });
  it('uses the durable timezone and handles DST midnight instead of 24h arithmetic', async () => {
    const fixture = harness('America/New_York');
    fixture.setNow('2026-03-08T05:00:00Z');
    const snapshot = await fixture.storage.usage.read();
    expect(snapshot.accountingDay).toBe('2026-03-08');
    expect(snapshot.resetAt).toBe(Date.parse('2026-03-09T04:00:00Z'));
    const changedZone = createStorage({
      browser: fixture.browser,
      clock: fixture.clock,
      timeZone: 'Asia/Kolkata',
    });
    expect((await changedZone.usage.read()).timeZone).toBe('America/New_York');
  });
  it('reserves known upper bounds and reconciles explicit costs once, retaining attempts', async () => {
    const { storage } = harness();
    expect(
      (
        await storage.usage.reserve(
          attempt('known', {
            requestCostEstimate: dollars(0.8),
            estimatedCostCap: dollars(1),
          }),
        )
      ).accepted,
    ).toBe(true);
    expect(
      (
        await storage.usage.reserve(
          attempt('over', {
            requestCostEstimate: dollars(0.3),
            estimatedCostCap: dollars(1),
          }),
        )
      ).accepted,
    ).toBe(false);
    await storage.usage.reconcile(
      'known',
      { estimatedCost: 0.2, currency: 'USD' },
      0,
    );
    await storage.usage.reconcile(
      'known',
      { estimatedCost: 0, currency: 'USD' },
      0,
    );
    expect((await storage.usage.read()).estimatedCost).toEqual(dollars(0.2));
    expect(
      (
        await storage.usage.reserve(
          attempt('after', {
            requestCostEstimate: dollars(0.8),
            estimatedCostCap: dollars(1),
          }),
        )
      ).accepted,
    ).toBe(true);
    expect((await storage.usage.read()).attempts).toBe(2);
  });
  it('keeps conservative estimates for unknown outcomes and blocks unverifiable caps', async () => {
    const { storage } = harness();
    await storage.usage.reserve(
      attempt('estimated', { requestCostEstimate: dollars(0.8) }),
    );
    await storage.usage.reconcile('estimated', null, 0);
    expect((await storage.usage.read()).estimatedCost).toEqual(dollars(0.8));
    expect(
      (
        await storage.usage.reserve(
          attempt('unknown', { estimatedCostCap: dollars(1) }),
        )
      ).accepted,
    ).toBe(false);
    await storage.usage.reserve(attempt('uncapped'));
    expect((await storage.usage.read()).estimatedCost).toBeNull();
    expect(
      (
        await storage.usage.reserve(
          attempt('cap-after-unknown', {
            requestCostEstimate: dollars(0),
            estimatedCostCap: dollars(1),
            dailyRequestLimit: 10,
          }),
        )
      ).accepted,
    ).toBe(false);
  });
  it('does not invent currency conversions or negative refunds', async () => {
    const { storage } = harness();
    await storage.usage.reserve(
      attempt('request', { requestCostEstimate: dollars(0.8) }),
    );
    await storage.usage.reconcile(
      'request',
      { estimatedCost: 0.1, currency: 'EUR' },
      0,
    );
    expect((await storage.usage.read()).estimatedCost).toBeNull();
    await expect(
      storage.usage.reconcile(
        'request',
        { estimatedCost: -1, currency: 'USD' },
        0,
      ),
    ).rejects.toThrow('invalid_request');
  });
  it('rejects malformed inputs and persisted records with private data without replacing them', async () => {
    const { storage, local } = harness();
    expect(
      (
        await storage.usage.reserve({
          ...attempt('raw'),
          text: 'private post',
        } as never)
      ).accepted,
    ).toBe(false);
    const record = { schemaVersion: 2, text: 'private post' };
    await local.set(USAGE_KEY, record);
    await expect(storage.usage.read()).rejects.toThrow('unsupported_schema');
    expect(await local.get(USAGE_KEY)).toEqual(record);
  });
  it('does not settle an old-generation request after invalidation', async () => {
    const { storage } = harness();
    await storage.usage.reserve(attempt('old'));
    await storage.settings.invalidate(0);
    await expect(
      storage.usage.reconcile('old', { estimatedCost: 0, currency: 'USD' }, 0),
    ).rejects.toThrow('cancelled');
    await expect(
      storage.usage.reconcile('old', { estimatedCost: 0, currency: 'USD' }, 1),
    ).rejects.toThrow('cancelled');
    expect((await storage.usage.read()).attempts).toBe(1);
  });
});
