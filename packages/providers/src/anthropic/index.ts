import {
  ClassificationInputSchema,
  ClassificationResultSchema,
  REMOTE_CATEGORY_IDS,
  type ClassifierAdapter,
  type ErrorCode,
  type NetworkClient,
  type PublicError,
} from '@clearedin/contracts';
import { buildClassificationPrompt } from '@clearedin/taxonomy';

export const ANTHROPIC_CAPABILITIES = Object.freeze({
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  apiVersion: '2026-10-21',
  adapterVersion: '1.0.0',
  endpoint: 'https://api.anthropic.com/v1/messages',
  permissionHost: 'https://api.anthropic.com/*',
  scoreKind: 'self_reported',
  maxOutputTokens: 1024,
  maxResponseBytes: 32768,
  maxRequestBytes: 65536,
  verifiedAt: '2026-11-16',
  liveTest: 'untested',
  browserTest: 'untested',
  productionReady: false,
  pricing: {
    currency: 'USD',
    unit: 'million_tokens',
    input: 1,
    output: 5,
    cacheWrite5m: 1.25,
    cacheWrite1h: 2,
    cacheRead: 0.1,
  },
} as const);

export class AnthropicAdapterError extends Error implements PublicError {
  constructor(
    public readonly code: ErrorCode,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = 'AnthropicAdapterError';
  }
}
const fail = (code: ErrorCode, retryable = false): never => {
  throw new AnthropicAdapterError(code, retryable);
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('invalid_response');
  return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: string[]) => {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !(key in value))
  )
    fail('invalid_response');
};
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['sufficiency', 'abstention', 'categories'],
  properties: {
    sufficiency: { type: 'string', enum: ['sufficient', 'insufficient'] },
    abstention: {
      type: ['string', 'null'],
      enum: [
        null,
        'insufficient_text',
        'unsupported_language',
        'ambiguous',
        'refused',
      ],
    },
    categories: {
      type: 'array',
      description:
        'At most eleven unique categories. Empty when insufficient or abstaining.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'score'],
        properties: {
          id: { type: 'string', enum: REMOTE_CATEGORY_IDS },
          score: {
            type: 'number',
            description:
              'Finite membership score between 0 and 1 inclusive; self-reported.',
          },
        },
      },
    },
  },
};

async function boundedBody(
  response: Response,
  signal: AbortSignal,
): Promise<unknown> {
  if (Number(response.headers.get('content-length')) > 32768) {
    await response.body?.cancel();
    return fail('invalid_response');
  }
  if (!response.body) return fail('invalid_response');
  const reader = response.body.getReader();
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted) return fail('cancelled');
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return fail('invalid_response');
      }
      chunks.push(value);
    }
    if (signal.aborted) return fail('cancelled');
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      return JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      );
    } catch {
      return fail('invalid_response');
    }
  } finally {
    signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
}

/** Background-only transport. Never opts into dangerous browser access or retries. */
export function createAnthropicAdapter(
  network: NetworkClient,
): ClassifierAdapter {
  return {
    id: 'anthropic',
    async classify(rawInput, context) {
      if (context.signal.aborted) return fail('cancelled');
      if (context.model !== ANTHROPIC_CAPABILITIES.model)
        return fail('unsupported_model');
      if (!context.credential) return fail('credential_required');
      if (context.credential.length > 4096 || /[\r\n]/.test(context.credential))
        return fail('invalid_credential');
      const parsed = ClassificationInputSchema.safeParse(rawInput);
      if (!parsed.success) return fail('invalid_request');
      const input = parsed.data;
      let prompt;
      try {
        prompt = buildClassificationPrompt(input);
      } catch {
        return fail('unsupported_schema');
      }
      const metadata = {
        schemaVersion: 1 as const,
        requestId: input.requestId,
        provider: 'anthropic' as const,
        model: ANTHROPIC_CAPABILITIES.model,
        adapterVersion: ANTHROPIC_CAPABILITIES.adapterVersion,
        taxonomyVersion: input.taxonomyVersion,
        promptVersion: input.promptVersion,
      };
      if (input.extraction === 'partial' || !input.text.trim())
        return {
          ...metadata,
          sufficiency: 'insufficient',
          categories: [],
          abstention: 'insufficient_text',
        };
      const body = JSON.stringify({
        model: context.model,
        max_tokens: 1024,
        system: prompt.instructions,
        messages: [{ role: 'user', content: prompt.data }],
        output_config: { format: { type: 'json_schema', schema } },
      });
      if (new TextEncoder().encode(body).length > 65536)
        return fail('invalid_request');
      let response: Response;
      try {
        response = await network.fetch(ANTHROPIC_CAPABILITIES.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': context.credential,
            'anthropic-version': ANTHROPIC_CAPABILITIES.apiVersion,
          },
          body,
          signal: context.signal,
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
        });
      } catch {
        return fail(
          context.signal.aborted ? 'cancelled' : 'provider_unavailable',
          !context.signal.aborted,
        );
      }
      if (context.signal.aborted) {
        await response.body?.cancel();
        return fail('cancelled');
      }
      if (
        response.redirected ||
        (response.url && response.url !== ANTHROPIC_CAPABILITIES.endpoint)
      ) {
        await response.body?.cancel();
        return fail('invalid_response');
      }
      if (!response.ok) {
        await response.body?.cancel();
        const status = response.status;
        return fail(
          status === 401
            ? 'invalid_credential'
            : status === 403
              ? 'permission_denied'
              : status === 404
                ? 'unsupported_model'
                : status === 400
                  ? 'unsupported_schema'
                  : status === 429
                    ? 'rate_limited'
                    : 'provider_unavailable',
          status === 429 || status >= 500,
        );
      }
      try {
        const wire = record(await boundedBody(response, context.signal));
        if (wire.stop_reason === 'refusal') return fail('refused');
        if (
          wire.type !== 'message' ||
          wire.role !== 'assistant' ||
          wire.model !== context.model ||
          wire.stop_reason !== 'end_turn' ||
          !Array.isArray(wire.content) ||
          wire.content.length !== 1
        )
          return fail('invalid_response');
        const block = record(wire.content[0]);
        if (block.type !== 'text' || typeof block.text !== 'string')
          return fail('invalid_response');
        const result = record(JSON.parse(block.text));
        exact(result, ['sufficiency', 'abstention', 'categories']);
        if (!Array.isArray(result.categories)) return fail('invalid_response');
        const categories = result.categories.map((value) => {
          const item = record(value);
          exact(item, ['id', 'score']);
          return { ...item, scoreKind: 'self_reported' };
        });
        const usage = record(wire.usage);
        // Cached input accounting differs; include all reported input buckets, without fabricating cost.
        const counts = [
          usage.input_tokens,
          usage.output_tokens,
          usage.cache_creation_input_tokens ?? 0,
          usage.cache_read_input_tokens ?? 0,
        ];
        if (
          counts.some(
            (n) => typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0,
          )
        )
          return fail('invalid_response');
        const [base = 0, output = 0, writes = 0, reads = 0] =
          counts as number[];
        const normalized = ClassificationResultSchema.safeParse({
          ...metadata,
          ...result,
          categories,
          usage: { inputTokens: base + writes + reads, outputTokens: output },
        });
        if (!normalized.success) return fail('invalid_response');
        return normalized.data;
      } catch (error) {
        if (error instanceof AnthropicAdapterError) throw error;
        return fail(context.signal.aborted ? 'cancelled' : 'invalid_response');
      }
    },
  };
}
