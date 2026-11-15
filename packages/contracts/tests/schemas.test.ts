import { describe, expect, it } from 'vitest';
import {
  CategoryIdSchema,
  ClassificationInputSchema,
  ClassificationReplySchema,
  ClassificationResultSchema,
  ContentRequestSchema,
  DiagnosticExportSchema,
  EstimatedCostCapSchema,
  MoneyAmountSchema,
  OptionsRequestSchema,
  PopupRequestSchema,
  PreferencesSchema,
  PublicErrorSchema,
  PublicStatusSchema,
  ReplyMessageSchema,
  SettingsReplySchema,
  SettingsSchema,
  createDefaultSettings,
} from '../src';
import type { ClassificationResult } from '../src';

function result(): ClassificationResult {
  return {
    schemaVersion: 1,
    requestId: 'request-1',
    provider: 'typesafe',
    model: 'synthetic-model',
    adapterVersion: '1',
    taxonomyVersion: '1',
    promptVersion: '1',
    sufficiency: 'sufficient',
    categories: [
      { id: 'job_posting', score: 0.95, scoreKind: 'typed_membership' },
    ],
    abstention: null,
  };
}

const envelope = { protocolVersion: 1, requestId: 'request-1' } as const;

describe('classification validation', () => {
  it('accepts multi-label judgments without requiring scores to sum to one', () => {
    const value = result();
    value.categories.push({
      id: 'referral',
      score: 0.96,
      scoreKind: 'typed_membership',
    });
    expect(ClassificationResultSchema.parse(value)).toEqual(value);
  });

  it('rejects unknown categories and remote sponsored judgments', () => {
    expect(CategoryIdSchema.safeParse('other').success).toBe(false);
    for (const id of ['other', 'sponsored']) {
      expect(
        ClassificationResultSchema.safeParse({
          ...result(),
          categories: [{ id, score: 1, scoreKind: 'typed_membership' }],
        }).success,
      ).toBe(false);
    }
  });

  it('rejects duplicate categories, unknown properties, and provider-mismatched semantics', () => {
    const value = result();
    value.categories.push({ ...value.categories[0]! });
    expect(ClassificationResultSchema.safeParse(value).success).toBe(false);
    expect(
      ClassificationResultSchema.safeParse({ ...result(), rawBody: 'private' })
        .success,
    ).toBe(false);
    expect(
      ClassificationResultSchema.safeParse({ ...result(), provider: 'openai' })
        .success,
    ).toBe(false);
  });

  it.each([
    -0.1,
    1.1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])('rejects invalid score %s', (score) => {
    expect(
      ClassificationResultSchema.safeParse({
        ...result(),
        categories: [
          { id: 'job_posting', score, scoreKind: 'typed_membership' },
        ],
      }).success,
    ).toBe(false);
  });

  it.each([
    'ambiguous',
    'refused',
    'insufficient_text',
    'unsupported_language',
  ] as const)(
    'requires empty insufficient results for %s abstention',
    (abstention) => {
      expect(
        ClassificationResultSchema.safeParse({ ...result(), abstention })
          .success,
      ).toBe(false);
      expect(
        ClassificationResultSchema.safeParse({
          ...result(),
          abstention,
          sufficiency: 'insufficient',
        }).success,
      ).toBe(false);
      expect(
        ClassificationResultSchema.safeParse({
          ...result(),
          abstention,
          sufficiency: 'insufficient',
          categories: [],
        }).success,
      ).toBe(true);
    },
  );

  it('allows empty sufficient results and rejects evidence on insufficient results', () => {
    expect(
      ClassificationResultSchema.safeParse({ ...result(), categories: [] })
        .success,
    ).toBe(true);
    expect(
      ClassificationResultSchema.safeParse({
        ...result(),
        sufficiency: 'insufficient',
      }).success,
    ).toBe(false);
  });

  it('bounds text and refuses identity, credentials, or prompt overrides in provider input', () => {
    const input = {
      requestId: 'request-1',
      text: 'x'.repeat(8_000),
      extraction: 'complete',
      taxonomyVersion: '1',
      promptVersion: '1',
    };
    expect(ClassificationInputSchema.safeParse(input).success).toBe(true);
    expect(
      ClassificationInputSchema.safeParse({ ...input, text: `${input.text}x` })
        .success,
    ).toBe(false);
    for (const field of [
      'credential',
      'postId',
      'author',
      'endpoint',
      'prompt',
    ]) {
      expect(
        ClassificationInputSchema.safeParse({ ...input, [field]: 'unexpected' })
          .success,
      ).toBe(false);
    }
  });

  it('requires cost units to accompany cost and bounds identifiers', () => {
    expect(
      ClassificationResultSchema.safeParse({
        ...result(),
        usage: { estimatedCost: 0.1 },
      }).success,
    ).toBe(false);
    expect(
      ClassificationResultSchema.safeParse({
        ...result(),
        usage: { estimatedCost: 0.1, currency: 'USD' },
      }).success,
    ).toBe(true);
    expect(
      ClassificationResultSchema.safeParse({
        ...result(),
        model: 'm'.repeat(129),
      }).success,
    ).toBe(false);
  });
});

describe('settings and consent invariants', () => {
  it('creates fresh disabled neutral defaults', () => {
    const first = createDefaultSettings();
    expect(SettingsSchema.parse(first)).toEqual(first);
    expect(first.enabled).toBe(false);
    expect(new Set(Object.values(first.categoryModes))).toEqual(
      new Set(['show']),
    );
    first.categoryModes.referral = 'hide';
    expect(createDefaultSettings().categoryModes.referral).toBe('show');
  });

  it('requires exact categories and rejects credential persistence', () => {
    const defaults = createDefaultSettings();
    const incomplete: Partial<typeof defaults.categoryModes> = {
      ...defaults.categoryModes,
    };
    delete incomplete.sponsored;
    expect(
      SettingsSchema.safeParse({ ...defaults, categoryModes: incomplete })
        .success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({
        ...defaults,
        categoryModes: { ...defaults.categoryModes, other: 'hide' },
      }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ ...defaults, credential: 'never persist' })
        .success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ ...defaults, schemaVersion: 2 }).success,
    ).toBe(false);
  });

  it('cannot enable before consent or use another provider consent', () => {
    const defaults = createDefaultSettings();
    expect(
      SettingsSchema.safeParse({ ...defaults, enabled: true }).success,
    ).toBe(false);
    const configured = {
      ...defaults,
      enabled: true,
      provider: 'typesafe',
      model: 'test-model',
      consent: {
        version: '1',
        provider: 'typesafe',
        recipientId: 'typesafe-direct',
        dataClasses: ['post_text'],
        timestamp: 1,
        status: 'granted',
      },
    };
    expect(SettingsSchema.safeParse(configured).success).toBe(true);
    expect(
      SettingsSchema.safeParse({ ...configured, provider: 'openai' }).success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({
        ...configured,
        consent: { ...configured.consent, status: 'withdrawn' },
      }).success,
    ).toBe(false);
  });

  it('rejects invalid limits and unsupported language claims', () => {
    const defaults = createDefaultSettings();
    const preferences = {
      categoryModes: defaults.categoryModes,
      dailyRequestLimit: 200,
      estimatedCostCap: null,
      languages: ['en'],
    };
    expect(
      PreferencesSchema.safeParse({ ...preferences, dailyRequestLimit: 0 })
        .success,
    ).toBe(false);
    expect(
      PreferencesSchema.safeParse({ ...preferences, languages: ['en', 'fr'] })
        .success,
    ).toBe(false);
    expect(
      MoneyAmountSchema.safeParse({ amount: 0, currency: 'USD' }).success,
    ).toBe(true);
    expect(
      EstimatedCostCapSchema.safeParse({ amount: 0, currency: 'USD' }).success,
    ).toBe(false);
  });
});

describe('message privilege and redaction boundaries', () => {
  it('permits popup pause without credential/consent/data-management privileges', () => {
    expect(
      PopupRequestSchema.safeParse({
        ...envelope,
        type: 'SET_ENABLED',
        enabled: false,
      }).success,
    ).toBe(true);
    const credential = {
      ...envelope,
      type: 'SET_CREDENTIAL',
      provider: 'typesafe',
      credential: 'dummy-fixture',
    };
    expect(OptionsRequestSchema.safeParse(credential).success).toBe(true);
    expect(PopupRequestSchema.safeParse(credential).success).toBe(false);
    expect(ContentRequestSchema.safeParse(credential).success).toBe(false);
    for (const type of [
      'GET_SETTINGS',
      'CLEAR_DATA',
      'EXPORT_DIAGNOSTICS',
      'TEST_PROVIDER_CONNECTION',
    ]) {
      expect(PopupRequestSchema.safeParse({ ...envelope, type }).success).toBe(
        false,
      );
      expect(
        ContentRequestSchema.safeParse({ ...envelope, type }).success,
      ).toBe(false);
      expect(
        OptionsRequestSchema.safeParse({ ...envelope, type }).success,
      ).toBe(true);
    }
  });

  it('returns settings only through an explicitly sanitized settings schema', () => {
    const reply = {
      ...envelope,
      type: 'SETTINGS',
      settings: createDefaultSettings(),
    };
    expect(ReplyMessageSchema.safeParse(reply).success).toBe(true);
    expect(
      SettingsReplySchema.safeParse({
        ...reply,
        settings: { ...reply.settings, credential: 'private' },
      }).success,
    ).toBe(false);
  });

  it('does not let content choose provider, credentials, or endpoint', () => {
    const request = {
      ...envelope,
      type: 'CLASSIFY_POST',
      enablementGeneration: 1,
      post: {
        identity: {
          postId: 'local-id',
          contentDigest: 'a'.repeat(64),
          nodeGeneration: 0,
        },
        text: 'synthetic post',
        extraction: 'complete',
        extractorVersion: '1',
        localSponsored: false,
      },
    };
    expect(ContentRequestSchema.safeParse(request).success).toBe(true);
    for (const field of ['provider', 'credential', 'endpoint', 'headers']) {
      expect(
        ContentRequestSchema.safeParse({ ...request, [field]: 'unexpected' })
          .success,
      ).toBe(false);
    }
    expect(
      ContentRequestSchema.safeParse({ ...request, protocolVersion: 2 })
        .success,
    ).toBe(false);
  });

  it('preserves request correlation in classification replies', () => {
    const reply = {
      ...envelope,
      type: 'CLASSIFICATION_RESULT',
      enablementGeneration: 1,
      identity: {
        postId: 'local-id',
        contentDigest: 'a'.repeat(64),
        nodeGeneration: 0,
      },
      result: result(),
    };
    expect(ReplyMessageSchema.safeParse(reply).success).toBe(true);
    expect(
      ClassificationReplySchema.safeParse({ ...reply, requestId: 'different' })
        .success,
    ).toBe(false);
  });

  it('rejects raw provider errors and sensitive status fields', () => {
    expect(
      PublicErrorSchema.safeParse({
        code: 'invalid_credential',
        retryable: false,
      }).success,
    ).toBe(true);
    expect(
      PublicErrorSchema.safeParse({
        code: 'invalid_credential',
        retryable: false,
        message: 'raw upstream body',
      }).success,
    ).toBe(false);
    const status = {
      enabled: false,
      enablementGeneration: 0,
      provider: null,
      model: null,
      credentialConfigured: false,
      consentGranted: false,
      categoryModes: createDefaultSettings().categoryModes,
      state: 'disabled',
      error: null,
      dailyRequestsUsed: 0,
      dailyRequestLimit: 200,
      resetAt: null,
      resetTimeZone: 'UTC',
      sessionHiddenCount: 0,
    };
    expect(PublicStatusSchema.safeParse(status).success).toBe(true);
    expect(
      PublicStatusSchema.safeParse({ ...status, credential: 'private' })
        .success,
    ).toBe(false);
  });

  it('bounds diagnostics and refuses text, hashes, and identifiers', () => {
    const diagnostic = {
      schemaVersion: 1,
      extensionVersion: '0.1.0',
      browserFamily: 'chrome',
      events: [{ timestamp: 1, code: 'timeout' }],
    };
    expect(DiagnosticExportSchema.safeParse(diagnostic).success).toBe(true);
    for (const field of ['text', 'contentDigest', 'postId', 'url', 'headers']) {
      expect(
        DiagnosticExportSchema.safeParse({
          ...diagnostic,
          events: [{ timestamp: 1, code: 'timeout', [field]: 'private' }],
        }).success,
      ).toBe(false);
    }
    expect(
      DiagnosticExportSchema.safeParse({
        ...diagnostic,
        events: Array.from({ length: 201 }, () => ({
          timestamp: 1,
          code: 'timeout',
        })),
      }).success,
    ).toBe(false);
  });
});
