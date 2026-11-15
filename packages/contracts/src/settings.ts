import { z } from 'zod';
import {
  CategoryModesSchema,
  CurrencySchema,
  ModelIdSchema,
  ProviderIdSchema,
  TimestampSchema,
  VersionSchema,
  createDefaultCategoryModes,
} from './primitives';

export const ConsentRecordSchema = z.strictObject({
  version: VersionSchema,
  provider: ProviderIdSchema,
  recipientId: z.string().min(1).max(256),
  dataClasses: z
    .array(z.enum(['post_text', 'classification_instructions']))
    .min(1)
    .max(2)
    .refine(
      (values) => new Set(values).size === values.length,
      'Duplicate data class.',
    ),
  timestamp: TimestampSchema,
  status: z.enum(['granted', 'withdrawn']),
});

export const MoneyAmountSchema = z.strictObject({
  amount: z.number().finite().nonnegative(),
  currency: CurrencySchema,
});
export const EstimatedCostCapSchema = MoneyAmountSchema.extend({
  amount: z.number().finite().positive(),
});

export const PreferencesSchema = z.strictObject({
  categoryModes: CategoryModesSchema,
  dailyRequestLimit: z.number().int().min(1).max(100_000),
  estimatedCostCap: EstimatedCostCapSchema.nullable(),
  // English is the only evaluated target in v1; adding languages is a schema change.
  languages: z.array(z.literal('en')).length(1),
});

export const SettingsSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    enabled: z.boolean(),
    ...PreferencesSchema.shape,
    provider: ProviderIdSchema.nullable(),
    model: ModelIdSchema.nullable(),
    consent: ConsentRecordSchema.nullable(),
  })
  .superRefine((settings, context) => {
    if ((settings.provider === null) !== (settings.model === null)) {
      context.addIssue({
        code: 'custom',
        path: ['provider'],
        message: 'Provider and model must be selected together.',
      });
    }
    if (
      settings.consent?.status === 'granted' &&
      settings.consent.provider !== settings.provider
    ) {
      context.addIssue({
        code: 'custom',
        path: ['consent'],
        message: 'Granted consent must match the selected provider.',
      });
    }
    if (
      settings.enabled &&
      (settings.provider === null || settings.consent?.status !== 'granted')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['enabled'],
        message: 'Enabling requires a provider and granted consent.',
      });
    }
  });

export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;
export type EstimatedCostCap = z.infer<typeof EstimatedCostCapSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type Settings = z.infer<typeof SettingsSchema>;

export function createDefaultSettings(): Settings {
  return {
    schemaVersion: 1,
    enabled: false,
    categoryModes: createDefaultCategoryModes(),
    provider: null,
    model: null,
    dailyRequestLimit: 200,
    estimatedCostCap: null,
    languages: ['en'],
    consent: null,
  };
}
