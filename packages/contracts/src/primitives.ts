import { z } from 'zod';

export const CATEGORY_IDS = [
  'job_posting',
  'referral',
  'motivational_story',
  'engagement_bait',
  'product_launch',
  'technical_content',
  'career_advice',
  'industry_news',
  'personal_update',
  'event',
  'promotion',
  'sponsored',
] as const;
export const REMOTE_CATEGORY_IDS = [
  'job_posting',
  'referral',
  'motivational_story',
  'engagement_bait',
  'product_launch',
  'technical_content',
  'career_advice',
  'industry_news',
  'personal_update',
  'event',
  'promotion',
] as const;
export const PROVIDER_IDS = ['typesafe', 'openai', 'anthropic'] as const;
export const CategoryIdSchema = z.enum(CATEGORY_IDS);
export const RemoteCategoryIdSchema = z.enum(REMOTE_CATEGORY_IDS);
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export const CategoryModeSchema = z.enum(['show', 'hide', 'always_show']);
export const ExtractionCompletenessSchema = z.enum(['complete', 'partial']);
export const RequestIdSchema = z.string().min(1).max(128);
export const VersionSchema = z.string().min(1).max(64);
export const ModelIdSchema = z.string().min(1).max(128);
export const GenerationSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const TimestampSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const CategoryModesSchema = z.record(
  CategoryIdSchema,
  CategoryModeSchema,
);

export type CategoryId = z.infer<typeof CategoryIdSchema>;
export type RemoteCategoryId = z.infer<typeof RemoteCategoryIdSchema>;
export type ProviderId = z.infer<typeof ProviderIdSchema>;
export type CategoryMode = z.infer<typeof CategoryModeSchema>;
export type CategoryModes = z.infer<typeof CategoryModesSchema>;
export type ExtractionCompleteness = z.infer<
  typeof ExtractionCompletenessSchema
>;

export const CONTRACT_VERSION = 1 as const;
export const MAX_POST_CHARACTERS = 8_000;
export const MAX_PROVIDER_RESPONSE_BYTES = 32_768;

export function createDefaultCategoryModes(): CategoryModes {
  return CategoryModesSchema.parse(
    Object.fromEntries(CATEGORY_IDS.map((id) => [id, 'show'])),
  );
}
