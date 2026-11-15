import { z } from 'zod';
import {
  ClassificationResultSchema,
  ErrorCodeSchema,
  PublicErrorSchema,
} from './classification';
import { ExtractedPostSchema, PostIdentitySchema } from './post';
import {
  CategoryModesSchema,
  GenerationSchema,
  ModelIdSchema,
  ProviderIdSchema,
  RequestIdSchema,
  TimestampSchema,
  VersionSchema,
} from './primitives';
import {
  ConsentRecordSchema,
  PreferencesSchema,
  SettingsSchema,
} from './settings';

const envelope = { protocolVersion: z.literal(1), requestId: RequestIdSchema };
const GetPublicStatusSchema = z.strictObject({
  ...envelope,
  type: z.literal('GET_PUBLIC_STATUS'),
});
const GetSettingsSchema = z.strictObject({
  ...envelope,
  type: z.literal('GET_SETTINGS'),
});
const ClassifyPostSchema = z.strictObject({
  ...envelope,
  type: z.literal('CLASSIFY_POST'),
  post: ExtractedPostSchema,
  enablementGeneration: GenerationSchema,
});
const CancelSubscriptionSchema = z.strictObject({
  ...envelope,
  type: z.literal('CANCEL_SUBSCRIPTION'),
  classificationRequestId: RequestIdSchema,
});
const SetEnabledSchema = z.strictObject({
  ...envelope,
  type: z.literal('SET_ENABLED'),
  enabled: z.boolean(),
});
const SetPreferencesSchema = z.strictObject({
  ...envelope,
  type: z.literal('SET_PREFERENCES'),
  preferences: PreferencesSchema,
});
const SetProviderSchema = z.strictObject({
  ...envelope,
  type: z.literal('SET_PROVIDER'),
  provider: ProviderIdSchema,
  model: ModelIdSchema,
});
const SetCredentialSchema = z.strictObject({
  ...envelope,
  type: z.literal('SET_CREDENTIAL'),
  provider: ProviderIdSchema,
  credential: z.string().min(1).max(4_096),
});
const DisconnectProviderSchema = z.strictObject({
  ...envelope,
  type: z.literal('DISCONNECT_PROVIDER'),
  provider: ProviderIdSchema,
});
const SetConsentSchema = z.strictObject({
  ...envelope,
  type: z.literal('SET_CONSENT'),
  consent: ConsentRecordSchema,
});
const ClearDataSchema = z.strictObject({
  ...envelope,
  type: z.literal('CLEAR_DATA'),
});
const ExportDiagnosticsSchema = z.strictObject({
  ...envelope,
  type: z.literal('EXPORT_DIAGNOSTICS'),
});
// Tests use a packaged synthetic fixture, never caller-supplied text or endpoints.
const TestProviderConnectionSchema = z.strictObject({
  ...envelope,
  type: z.literal('TEST_PROVIDER_CONNECTION'),
});

export const ContentRequestSchema = z.discriminatedUnion('type', [
  GetPublicStatusSchema,
  ClassifyPostSchema,
  CancelSubscriptionSchema,
]);
export const PopupRequestSchema = z.discriminatedUnion('type', [
  GetPublicStatusSchema,
  SetEnabledSchema,
]);
export const OptionsRequestSchema = z.discriminatedUnion('type', [
  GetPublicStatusSchema,
  GetSettingsSchema,
  SetEnabledSchema,
  SetPreferencesSchema,
  SetProviderSchema,
  SetCredentialSchema,
  DisconnectProviderSchema,
  SetConsentSchema,
  ClearDataSchema,
  ExportDiagnosticsSchema,
  TestProviderConnectionSchema,
]);
export const RequestMessageSchema = z.discriminatedUnion('type', [
  GetPublicStatusSchema,
  GetSettingsSchema,
  ClassifyPostSchema,
  CancelSubscriptionSchema,
  SetEnabledSchema,
  SetPreferencesSchema,
  SetProviderSchema,
  SetCredentialSchema,
  DisconnectProviderSchema,
  SetConsentSchema,
  ClearDataSchema,
  ExportDiagnosticsSchema,
  TestProviderConnectionSchema,
]);

export const PublicStatusSchema = z.strictObject({
  enabled: z.boolean(),
  enablementGeneration: GenerationSchema,
  provider: ProviderIdSchema.nullable(),
  model: ModelIdSchema.nullable(),
  credentialConfigured: z.boolean(),
  consentGranted: z.boolean(),
  categoryModes: CategoryModesSchema,
  state: z.enum([
    'disabled',
    'ready',
    'working',
    'needs_setup',
    'limited',
    'unavailable',
  ]),
  error: PublicErrorSchema.nullable(),
  dailyRequestsUsed: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER),
  dailyRequestLimit: z.number().int().positive().max(100_000),
  resetAt: TimestampSchema.nullable(),
  resetTimeZone: z.string().min(1).max(64),
  sessionHiddenCount: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER),
});

export const DiagnosticEventSchema = z.strictObject({
  timestamp: TimestampSchema,
  code: ErrorCodeSchema,
  provider: ProviderIdSchema.optional(),
  model: ModelIdSchema.optional(),
  durationBucket: z
    .enum(['under_100ms', 'under_1s', 'under_10s', 'over_10s'])
    .optional(),
});
export const DiagnosticExportSchema = z.strictObject({
  schemaVersion: z.literal(1),
  extensionVersion: VersionSchema,
  browserFamily: z.enum(['chrome', 'firefox']),
  events: z.array(DiagnosticEventSchema).max(200),
});

export const AckReplySchema = z.strictObject({
  ...envelope,
  type: z.literal('ACK'),
  enablementGeneration: GenerationSchema,
});
export const ErrorReplySchema = z.strictObject({
  ...envelope,
  type: z.literal('ERROR'),
  error: PublicErrorSchema,
});
export const PublicStatusReplySchema = z.strictObject({
  ...envelope,
  type: z.literal('PUBLIC_STATUS'),
  status: PublicStatusSchema,
});
export const SettingsReplySchema = z.strictObject({
  ...envelope,
  type: z.literal('SETTINGS'),
  settings: SettingsSchema,
});
export const ClassificationReplySchema = z
  .strictObject({
    ...envelope,
    type: z.literal('CLASSIFICATION_RESULT'),
    identity: PostIdentitySchema,
    enablementGeneration: GenerationSchema,
    result: ClassificationResultSchema,
  })
  .refine(
    (reply) => reply.requestId === reply.result.requestId,
    'Classification reply IDs must match.',
  );
export const DiagnosticsReplySchema = z.strictObject({
  ...envelope,
  type: z.literal('DIAGNOSTICS'),
  diagnostics: DiagnosticExportSchema,
});
export const ProviderTestReplySchema = z
  .strictObject({
    ...envelope,
    type: z.literal('PROVIDER_TEST_RESULT'),
    provider: ProviderIdSchema,
    model: ModelIdSchema,
    outcome: z.enum(['passed', 'failed']),
    error: PublicErrorSchema.nullable(),
  })
  .refine(
    (reply) => (reply.outcome === 'passed') === (reply.error === null),
    'Connection-test outcome must match its error state.',
  );
export const ReplyMessageSchema = z.discriminatedUnion('type', [
  AckReplySchema,
  ErrorReplySchema,
  PublicStatusReplySchema,
  SettingsReplySchema,
  ClassificationReplySchema,
  DiagnosticsReplySchema,
  ProviderTestReplySchema,
]);
export const BroadcastMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...envelope,
    type: z.literal('RESTORE_ALL'),
    enablementGeneration: GenerationSchema,
    reason: z.enum([
      'paused',
      'consent_withdrawn',
      'provider_changed',
      'data_cleared',
      'extractor_unhealthy',
    ]),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('STATUS_CHANGED'),
    status: PublicStatusSchema,
  }),
]);

export type ContentRequest = z.infer<typeof ContentRequestSchema>;
export type PopupRequest = z.infer<typeof PopupRequestSchema>;
export type OptionsRequest = z.infer<typeof OptionsRequestSchema>;
export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ReplyMessage = z.infer<typeof ReplyMessageSchema>;
export type BroadcastMessage = z.infer<typeof BroadcastMessageSchema>;
export type PublicStatus = z.infer<typeof PublicStatusSchema>;
export type DiagnosticEvent = z.infer<typeof DiagnosticEventSchema>;
export type DiagnosticExport = z.infer<typeof DiagnosticExportSchema>;
export type ErrorReply = z.infer<typeof ErrorReplySchema>;

export type ReplyFor<Request extends RequestMessage> =
  | ErrorReply
  | (Request extends { type: 'GET_PUBLIC_STATUS' }
      ? z.infer<typeof PublicStatusReplySchema>
      : Request extends { type: 'GET_SETTINGS' }
        ? z.infer<typeof SettingsReplySchema>
        : Request extends { type: 'CLASSIFY_POST' }
          ? z.infer<typeof ClassificationReplySchema>
          : Request extends { type: 'EXPORT_DIAGNOSTICS' }
            ? z.infer<typeof DiagnosticsReplySchema>
            : Request extends { type: 'TEST_PROVIDER_CONNECTION' }
              ? z.infer<typeof ProviderTestReplySchema>
              : z.infer<typeof AckReplySchema>);

export interface MessageClient<Allowed extends RequestMessage> {
  send<Request extends Allowed>(
    request: Request,
    signal?: AbortSignal,
  ): Promise<ReplyFor<Request>>;
  subscribe(listener: (event: BroadcastMessage) => void): () => void;
}
export type ContentClient = MessageClient<ContentRequest>;
export type PopupClient = MessageClient<PopupRequest>;
export type OptionsClient = MessageClient<OptionsRequest>;
