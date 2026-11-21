import {
  ClassificationInputSchema,
  ClassificationResultSchema,
  MAX_PROVIDER_RESPONSE_BYTES,
  REMOTE_CATEGORY_IDS,
  type ClassifierAdapter,
  type NetworkClient,
  type PublicError,
} from '@clearedin/contracts';
import { buildClassificationPrompt } from '@clearedin/taxonomy';
import { PROVIDER_CATALOG } from '../catalog';

export const OPENAI_CAPABILITIES = Object.freeze({
  provider: 'openai',
  model: PROVIDER_CATALOG.openai.model,
  adapterVersion: '1.0.0',
  api: 'Responses v1',
  endpoint: PROVIDER_CATALOG.openai.endpoint,
  hostPermissions: ['https://api.openai.com/*'],
  scoreKind: 'self_reported',
  verifiedOn: '2026-11-16',
  live: 'untested',
  browser: 'untested',
  clientKeySecurity:
    'OpenAI recommends server-side keys. A user-supplied browser-session key is accessible to privileged extension contexts.',
  pricing: {
    currency: 'USD',
    unit: 'million_tokens',
    input: 2,
    cachedInput: 0.2,
    output: 12,
  },
} as const);
export class OpenAIProviderError extends Error implements PublicError {
  constructor(
    public readonly code: PublicError['code'],
    public readonly retryable = false,
  ) {
    super(code);
    this.name = 'OpenAIProviderError';
  }
}
const fail = (code: PublicError['code'], retryable = false): never => {
  throw new OpenAIProviderError(code, retryable);
};
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['sufficiency', 'categories', 'abstention'],
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
      maxItems: REMOTE_CATEGORY_IDS.length,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'score'],
        properties: {
          id: { type: 'string', enum: REMOTE_CATEGORY_IDS },
          score: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail('invalid_response');
  return value as Record<string, unknown>;
}
async function body(response: Response, signal: AbortSignal): Promise<unknown> {
  if (
    Number(response.headers.get('content-length')) > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    await response.body?.cancel();
    return fail('invalid_response');
  }
  if (!response.body) return fail('invalid_response');
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    let size = 0;
    let text = '';
    const decoder = new TextDecoder('utf-8', { fatal: true });
    while (true) {
      if (signal.aborted) return fail('cancelled');
      const chunk = await reader.read();
      if (signal.aborted) return fail('cancelled');
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        return fail('invalid_response');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof OpenAIProviderError) throw error;
    return fail(signal.aborted ? 'cancelled' : 'invalid_response');
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
export function createOpenAIAdapter(network: NetworkClient): ClassifierAdapter {
  return {
    id: 'openai',
    async classify(raw, context) {
      if (context.signal.aborted) return fail('cancelled');
      if (context.model !== OPENAI_CAPABILITIES.model)
        return fail('unsupported_model');
      if (!context.credential.trim()) return fail('credential_required');
      if (context.credential.length > 4096 || /[\r\n]/.test(context.credential))
        return fail('invalid_credential');
      const parsed = ClassificationInputSchema.safeParse(raw);
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
        provider: 'openai' as const,
        model: context.model,
        adapterVersion: OPENAI_CAPABILITIES.adapterVersion,
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
      const request = JSON.stringify({
        model: context.model,
        instructions: prompt.instructions,
        input: [{ role: 'user', content: prompt.data }],
        store: false,
        stream: false,
        max_output_tokens: 2048,
        reasoning: { effort: 'none' },
        text: {
          format: {
            type: 'json_schema',
            name: 'classification',
            strict: true,
            schema,
          },
        },
      });
      if (new TextEncoder().encode(request).byteLength > 65536)
        return fail('invalid_request');
      let response;
      try {
        response = await network.fetch(OPENAI_CAPABILITIES.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.credential}`,
            'Content-Type': 'application/json',
          },
          body: request,
          signal: context.signal,
          redirect: 'error',
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
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
        (response.url && response.url !== OPENAI_CAPABILITIES.endpoint)
      ) {
        await response.body?.cancel();
        return fail('invalid_response');
      }
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401) return fail('invalid_credential');
        if (response.status === 403) return fail('permission_denied');
        if (response.status === 404) return fail('unsupported_model');
        if (response.status === 400 || response.status === 422)
          return fail('unsupported_schema');
        if (response.status === 429) return fail('rate_limited', true);
        return fail('provider_unavailable', response.status >= 500);
      }
      const wire = record(await body(response, context.signal));
      if (wire.status !== 'completed') return fail('invalid_response');
      if (!Array.isArray(wire.output) || wire.output.length !== 1)
        return fail('invalid_response');
      const message = record(wire.output[0]);
      if (
        message.type !== 'message' ||
        message.role !== 'assistant' ||
        message.status !== 'completed' ||
        !Array.isArray(message.content) ||
        message.content.length !== 1
      )
        return fail('invalid_response');
      const content = record(message.content[0]);
      if (content.type === 'refusal') return fail('refused');
      if (content.type !== 'output_text' || typeof content.text !== 'string')
        return fail('invalid_response');
      let data;
      try {
        data = record(JSON.parse(content.text));
      } catch {
        return fail('invalid_response');
      }
      if (
        Object.keys(data).sort().join() !==
          'abstention,categories,sufficiency' ||
        !Array.isArray(data.categories)
      )
        return fail('invalid_response');
      const categories = data.categories.map((entry: unknown) => {
        const category = record(entry);
        if (Object.keys(category).sort().join() !== 'id,score')
          return fail('invalid_response');
        return { ...category, scoreKind: 'self_reported' };
      });
      const usage = wire.usage === undefined ? undefined : record(wire.usage);
      const result = ClassificationResultSchema.safeParse({
        ...metadata,
        ...data,
        categories,
        ...(usage
          ? {
              usage: {
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
              },
            }
          : {}),
      });
      if (
        !result.success ||
        (usage &&
          (usage.input_tokens === undefined ||
            usage.output_tokens === undefined))
      )
        return fail('invalid_response');
      return result.data;
    },
  };
}
