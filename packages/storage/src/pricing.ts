import {
  MoneyAmountSchema,
  ProviderIdSchema,
  type MoneyAmount,
  type ProviderId,
} from '@clearedin/contracts';
import { StorageError } from './core';

/** Inject verified metadata; this package ships no prices or supported model claims. */
export interface KnownPricing {
  provider: ProviderId;
  model: string;
  version: string;
  verifiedOn: string;
  currency: string;
  perInputToken?: number;
  perOutputToken?: number;
  perQuestion?: number;
}
export interface BillingUnits {
  inputTokens?: number;
  outputTokens?: number;
  questions?: number;
}

/** All priced dimensions need conservative upper-bound units before dispatch. */
export function estimateKnownCost(
  pricing: KnownPricing | null,
  upperBounds: BillingUnits,
): MoneyAmount | null {
  if (!pricing) return null;
  if (
    !ProviderIdSchema.safeParse(pricing.provider).success ||
    !pricing.model ||
    !pricing.version ||
    !/^\d{4}-\d{2}-\d{2}$/.test(pricing.verifiedOn) ||
    !Number.isFinite(Date.parse(pricing.verifiedOn)) ||
    new Date(pricing.verifiedOn).toISOString().slice(0, 10) !==
      pricing.verifiedOn
  )
    throw new StorageError('invalid_request');
  let amount = 0;
  let priced = false;
  for (const [rate, units] of [
    [pricing.perInputToken, upperBounds.inputTokens],
    [pricing.perOutputToken, upperBounds.outputTokens],
    [pricing.perQuestion, upperBounds.questions],
  ]) {
    if (rate === undefined) continue;
    if (!Number.isFinite(rate) || rate < 0)
      throw new StorageError('invalid_request');
    if (units === undefined) return null;
    if (!Number.isSafeInteger(units) || units < 0)
      throw new StorageError('invalid_request');
    amount += rate * units;
    priced = true;
  }
  if (!priced) return null;
  const result = MoneyAmountSchema.safeParse({
    amount,
    currency: pricing.currency,
  });
  if (!result.success) throw new StorageError('invalid_request');
  return result.data;
}
