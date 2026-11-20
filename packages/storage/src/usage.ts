import {
  EstimatedCostCapSchema,
  MoneyAmountSchema,
  ProviderIdSchema,
  RequestIdSchema,
  TimestampSchema,
  UsageSchema,
  type Clock,
  type MoneyAmount,
  type UsageReservation,
  type UsageSnapshot,
  type UsageStore,
} from '@clearedin/contracts';
import { StorageError, USAGE_KEY, object, type StorageContext } from './core';

interface Entry extends UsageReservation {
  reconciled: boolean;
}
interface Ledger {
  schemaVersion: 1;
  timeZone: string;
  highWater: number;
  entries: Entry[];
}

// A ledger uses one time zone for every entry. Keep only its formatter so a
// large ledger does not allocate an Intl formatter per validated reservation.
let calendar: { zone: string; formatter: Intl.DateTimeFormat } | undefined;
function dayAt(timestamp: number, timeZone: string): string {
  if (calendar?.zone !== timeZone) {
    calendar = {
      zone: timeZone,
      formatter: new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    };
  }
  const parts = calendar.formatter.formatToParts(timestamp);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function previousDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}
function resetAt(now: number, timeZone: string): number {
  const day = dayAt(now, timeZone);
  // Find the next calendar boundary, including 23/25-hour daylight-saving days.
  let lower = now;
  let upper = now + 36 * 3_600_000;
  while (upper - lower > 1) {
    const middle = Math.floor((upper + lower) / 2);
    if (dayAt(middle, timeZone) > day) upper = middle;
    else lower = middle;
  }
  return upper;
}
function money(value: unknown): MoneyAmount | null {
  if (value === null) return null;
  const parsed = MoneyAmountSchema.safeParse(value);
  if (!parsed.success) throw new StorageError('unsupported_schema');
  return parsed.data;
}
function parseLedger(value: unknown): Ledger {
  const record = object(value, [
    'schemaVersion',
    'timeZone',
    'highWater',
    'entries',
  ]);
  if (
    record.schemaVersion !== 1 ||
    typeof record.timeZone !== 'string' ||
    record.timeZone.length > 64 ||
    !TimestampSchema.safeParse(record.highWater).success ||
    !Array.isArray(record.entries) ||
    record.entries.length > 200_000
  ) {
    throw new StorageError('unsupported_schema');
  }
  try {
    dayAt(record.highWater as number, record.timeZone);
  } catch {
    throw new StorageError('unsupported_schema');
  }
  const seen = new Set<string>();
  const entries = record.entries.map((value): Entry => {
    const entry = object(value, [
      'requestId',
      'provider',
      'accountingDay',
      'timeZone',
      'reservedAt',
      'enablementGeneration',
      'estimatedCost',
      'reconciled',
    ]);
    if (
      !RequestIdSchema.safeParse(entry.requestId).success ||
      seen.has(entry.requestId as string) ||
      !ProviderIdSchema.safeParse(entry.provider).success ||
      !TimestampSchema.safeParse(entry.reservedAt).success ||
      !TimestampSchema.safeParse(entry.enablementGeneration).success ||
      entry.timeZone !== record.timeZone ||
      typeof entry.accountingDay !== 'string' ||
      entry.accountingDay !==
        dayAt(entry.reservedAt as number, record.timeZone as string) ||
      (entry.reservedAt as number) > (record.highWater as number) ||
      typeof entry.reconciled !== 'boolean'
    ) {
      throw new StorageError('unsupported_schema');
    }
    seen.add(entry.requestId as string);
    return {
      ...entry,
      estimatedCost: money(entry.estimatedCost),
    } as unknown as Entry;
  });
  return {
    schemaVersion: 1,
    timeZone: record.timeZone,
    highWater: record.highWater as number,
    entries,
  };
}
function total(entries: readonly Entry[]): MoneyAmount | null {
  if (entries.length === 0) return null;
  const currency = entries[0]!.estimatedCost?.currency;
  if (
    !currency ||
    entries.some((entry) => entry.estimatedCost?.currency !== currency)
  )
    return null;
  const amount = entries.reduce(
    (sum, entry) => sum + entry.estimatedCost!.amount,
    0,
  );
  return Number.isFinite(amount) ? { amount, currency } : null;
}

export function createUsageStore(
  context: StorageContext,
  clock: Pick<Clock, 'now'>,
  timeZone: string,
) {
  try {
    dayAt(0, timeZone);
  } catch {
    throw new StorageError('invalid_request');
  }
  async function load(): Promise<Ledger> {
    const now = clock.now();
    if (!TimestampSchema.safeParse(now).success)
      throw new StorageError('storage_unavailable');
    const raw = await context.local.get(USAGE_KEY);
    const ledger: Ledger =
      raw === undefined || raw === null
        ? { schemaVersion: 1, highWater: now, timeZone, entries: [] }
        : parseLedger(raw);
    ledger.highWater = Math.max(now, ledger.highWater);
    const previous = previousDay(dayAt(ledger.highWater, ledger.timeZone));
    ledger.entries = ledger.entries.filter(
      (entry) => entry.accountingDay >= previous,
    );
    return ledger;
  }
  async function save(ledger: Ledger) {
    await context.local.set(USAGE_KEY, ledger);
  }
  async function readSnapshot(): Promise<UsageSnapshot> {
    const ledger = await load();
    const accountingDay = dayAt(ledger.highWater, ledger.timeZone);
    const entries = ledger.entries.filter(
      (entry) => entry.accountingDay === accountingDay,
    );
    await save(ledger);
    return {
      accountingDay,
      timeZone: ledger.timeZone,
      attempts: entries.length,
      estimatedCost: total(entries),
      resetAt: resetAt(ledger.highWater, ledger.timeZone),
    };
  }
  const store: UsageStore = {
    reserve(input) {
      // Reject arbitrary extra data before it can be copied to persistent storage.
      let captured: typeof input;
      try {
        object(input, [
          'requestId',
          'provider',
          'expectedGeneration',
          'dailyRequestLimit',
          'estimatedCostCap',
          'requestCostEstimate',
        ]);
        if (
          !RequestIdSchema.safeParse(input.requestId).success ||
          !ProviderIdSchema.safeParse(input.provider).success ||
          !Number.isInteger(input.dailyRequestLimit) ||
          input.dailyRequestLimit < 1 ||
          input.dailyRequestLimit > 100_000 ||
          (input.estimatedCostCap !== null &&
            !EstimatedCostCapSchema.safeParse(input.estimatedCostCap)
              .success) ||
          (input.requestCostEstimate !== null &&
            !MoneyAmountSchema.safeParse(input.requestCostEstimate).success)
        )
          throw new StorageError('invalid_request');
        captured = {
          ...input,
          estimatedCostCap: input.estimatedCostCap
            ? { ...input.estimatedCostCap }
            : null,
          requestCostEstimate: input.requestCostEstimate
            ? { ...input.requestCostEstimate }
            : null,
        };
      } catch {
        return Promise.resolve({
          accepted: false,
          error: { code: 'invalid_request', retryable: false },
        } as const);
      }
      return context.run(async () => {
        try {
          await context.checkGeneration(captured.expectedGeneration);
        } catch (error) {
          if (error instanceof StorageError && error.code === 'cancelled')
            return {
              accepted: false,
              error: { code: 'cancelled', retryable: false },
            } as const;
          throw error;
        }
        const ledger = await load();
        const day = dayAt(ledger.highWater, ledger.timeZone);
        const today = ledger.entries.filter(
          (entry) => entry.accountingDay === day,
        );
        // Also persist the clock watermark on refusals; a clock rollback cannot
        // cause a second reset after a worker restart.
        if (
          ledger.entries.some((entry) => entry.requestId === captured.requestId)
        ) {
          await save(ledger);
          return {
            accepted: false,
            error: { code: 'invalid_request', retryable: false },
          } as const;
        }
        if (today.length >= captured.dailyRequestLimit) {
          await save(ledger);
          return {
            accepted: false,
            error: { code: 'daily_limit', retryable: false },
          } as const;
        }
        const cap = captured.estimatedCostCap;
        const estimate = captured.requestCostEstimate;
        const used = total(today);
        if (
          cap &&
          (!estimate ||
            estimate.currency !== cap.currency ||
            (today.length > 0 && (!used || used.currency !== cap.currency)) ||
            estimate.amount + (used?.amount ?? 0) > cap.amount)
        ) {
          await save(ledger);
          return {
            accepted: false,
            error: { code: 'estimated_cost_limit', retryable: false },
          } as const;
        }
        const reservation: UsageReservation = {
          requestId: captured.requestId,
          provider: captured.provider,
          accountingDay: day,
          timeZone: ledger.timeZone,
          reservedAt: ledger.highWater,
          enablementGeneration: captured.expectedGeneration,
          estimatedCost: estimate,
        };
        ledger.entries.push({ ...reservation, reconciled: false });
        await save(ledger); // Dispatch is permitted only after this resolves.
        return {
          accepted: true,
          reservation: structuredClone(reservation),
        } as const;
      });
    },
    reconcile(requestId, usage, expectedGeneration) {
      if (!RequestIdSchema.safeParse(requestId).success)
        return Promise.reject(new StorageError('invalid_request'));
      const parsed = usage === null ? null : UsageSchema.safeParse(usage);
      if (parsed && !parsed.success)
        return Promise.reject(new StorageError('invalid_request'));
      const reported = parsed?.data;
      return context.run(async () => {
        await context.checkGeneration(expectedGeneration);
        const ledger = await load();
        const entry = ledger.entries.find(
          (candidate) => candidate.requestId === requestId,
        );
        if (entry && entry.enablementGeneration !== expectedGeneration)
          throw new StorageError('cancelled');
        if (
          entry &&
          !entry.reconciled &&
          reported?.estimatedCost !== undefined &&
          reported.currency !== undefined
        ) {
          // Explicit complete reported cost can settle an upper bound. Token-only,
          // failed, cancelled, or unknown outcomes retain the original reservation.
          if (
            entry.estimatedCost &&
            entry.estimatedCost.currency !== reported.currency
          ) {
            entry.estimatedCost = null; // Currency conversion is never inferred.
          } else
            entry.estimatedCost = {
              amount: reported.estimatedCost,
              currency: reported.currency,
            };
          entry.reconciled = true;
        }
        await save(ledger);
      });
    },
    read: () => context.run(readSnapshot),
    clear: (expectedGeneration) =>
      context.run(async () => {
        await context.checkGeneration(expectedGeneration);
        await context.local.remove(USAGE_KEY);
      }),
  };
  return { store, readSnapshot };
}
