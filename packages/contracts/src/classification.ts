import { z } from 'zod';
import {
  CurrencySchema,
  ExtractionCompletenessSchema,
  MAX_POST_CHARACTERS,
  ModelIdSchema,
  ProviderIdSchema,
  REMOTE_CATEGORY_IDS,
  RemoteCategoryIdSchema,
  RequestIdSchema,
  VersionSchema,
} from './primitives';

export const ClassificationInputSchema = z.strictObject({
  requestId: RequestIdSchema,
  text: z.string().max(MAX_POST_CHARACTERS),
  extraction: ExtractionCompletenessSchema,
  taxonomyVersion: VersionSchema,
  promptVersion: VersionSchema,
});

export const UsageSchema = z
  .strictObject({
    inputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    outputTokens: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    questions: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .optional(),
    estimatedCost: z.number().finite().nonnegative().optional(),
    currency: CurrencySchema.optional(),
  })
  .superRefine((usage, context) => {
    if (
      (usage.estimatedCost === undefined) !==
      (usage.currency === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Cost and currency must be supplied together.',
      });
    }
  });

export const CategoryJudgmentSchema = z.strictObject({
  id: RemoteCategoryIdSchema,
  score: z.number().finite().min(0).max(1),
  scoreKind: z.enum(['typed_membership', 'self_reported']),
});

export const ClassificationResultSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    requestId: RequestIdSchema,
    provider: ProviderIdSchema,
    model: ModelIdSchema,
    adapterVersion: VersionSchema,
    taxonomyVersion: VersionSchema,
    promptVersion: VersionSchema,
    sufficiency: z.enum(['sufficient', 'insufficient']),
    categories: z.array(CategoryJudgmentSchema).max(REMOTE_CATEGORY_IDS.length),
    abstention: z
      .enum([
        'insufficient_text',
        'unsupported_language',
        'ambiguous',
        'refused',
      ])
      .nullable(),
    usage: UsageSchema.optional(),
  })
  .superRefine((result, context) => {
    const seen = new Set<string>();
    result.categories.forEach((category, index) => {
      if (seen.has(category.id)) {
        context.addIssue({
          code: 'custom',
          path: ['categories', index, 'id'],
          message: 'Duplicate category.',
        });
      }
      seen.add(category.id);
      const expectedKind =
        result.provider === 'typesafe' ? 'typed_membership' : 'self_reported';
      if (category.scoreKind !== expectedKind) {
        context.addIssue({
          code: 'custom',
          path: ['categories', index, 'scoreKind'],
          message: 'Score semantics do not match the provider.',
        });
      }
    });
    if (result.abstention !== null && result.sufficiency !== 'insufficient') {
      context.addIssue({
        code: 'custom',
        path: ['sufficiency'],
        message: 'An abstention must be insufficient.',
      });
    }
    if (result.sufficiency === 'insufficient' && result.categories.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'Insufficient results must not retain remote judgments.',
      });
    }
  });

export const ERROR_CODES = [
  'invalid_request',
  'unauthorized_sender',
  'unsupported_route',
  'not_enabled',
  'consent_required',
  'credential_required',
  'invalid_credential',
  'permission_denied',
  'unsupported_provider',
  'unsupported_model',
  'provider_unavailable',
  'rate_limited',
  'daily_limit',
  'estimated_cost_limit',
  'queue_full',
  'timeout',
  'cancelled',
  'invalid_response',
  'refused',
  'storage_unavailable',
  'unsupported_schema',
  'internal_error',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
// UI copy maps these codes to local text. Raw provider bodies/messages are not public errors.
export const PublicErrorSchema = z.strictObject({
  code: ErrorCodeSchema,
  retryable: z.boolean(),
  retryAfterMs: z.number().int().nonnegative().max(86_400_000).optional(),
});

export type ClassificationInput = z.infer<typeof ClassificationInputSchema>;
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;
export type CategoryJudgment = z.infer<typeof CategoryJudgmentSchema>;
export type Usage = z.infer<typeof UsageSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type PublicError = z.infer<typeof PublicErrorSchema>;
