import { describe, expect, it, vi } from 'vitest';
import { createAnthropicAdapter, ANTHROPIC_CAPABILITIES } from '../index';
const anthropicJudgments = {
  sufficiency: 'sufficient',
  abstention: null,
  categories: [
    { id: 'job_posting', score: 0.98 },
    { id: 'referral', score: 0.95 },
  ],
};
const anthropicMessage = (judgments: unknown = anthropicJudgments) => ({
  id: 'msg_synthetic',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(judgments) }],
  usage: { input_tokens: 100, output_tokens: 40 },
});

const input = {
  requestId: 'synthetic-1',
  text: 'We are hiring engineers. I can refer you.',
  extraction: 'complete' as const,
  taxonomyVersion: '1.0.0',
  promptVersion: '1.0.0',
};
const context = () => ({
  model: ANTHROPIC_CAPABILITIES.model,
  credential: 'synthetic-key',
  signal: new AbortController().signal,
});
const setup = (wire: unknown = anthropicMessage(), status = 200) => {
  const fetch = vi.fn(
    async () => new Response(JSON.stringify(wire), { status }),
  );
  return { fetch, adapter: createAnthropicAdapter({ fetch }) };
};
describe('Anthropic native adapter', () => {
  it('uses native schema, fixed endpoint and canonical prompt; normalizes multiple labels', async () => {
    const { adapter, fetch } = setup();
    const result = await adapter.classify(input, context());
    expect(result.categories).toHaveLength(2);
    expect(result.categories[0]?.scoreKind).toBe('self_reported');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 40 });
    const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(ANTHROPIC_CAPABILITIES.endpoint);
    expect(call[1]).toMatchObject({
      redirect: 'error',
      credentials: 'omit',
      headers: {
        'anthropic-version': '2026-10-21',
        'x-api-key': 'synthetic-key',
      },
    });
    const body = JSON.parse(call[1].body as string);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.tools).toBeUndefined();
    expect(body.messages).toHaveLength(1);
    expect(body.system).not.toContain(input.text);
  });
  it.each(['refusal', 'max_tokens', 'tool_use', 'pause_turn'])(
    'rejects stop reason %s',
    async (reason) => {
      const { adapter } = setup({ ...anthropicMessage(), stop_reason: reason });
      await expect(adapter.classify(input, context())).rejects.toMatchObject({
        code: reason === 'refusal' ? 'refused' : 'invalid_response',
      });
    },
  );
  it.each([
    { ...anthropicJudgments, categories: [{ id: 'sponsored', score: 1 }] },
    { ...anthropicJudgments, categories: [{ id: 'referral', score: 2 }] },
    {
      ...anthropicJudgments,
      categories: [
        { id: 'referral', score: 0.9 },
        { id: 'referral', score: 0.9 },
      ],
    },
    { ...anthropicJudgments, sufficiency: 'insufficient' },
    { ...anthropicJudgments, abstention: 'ambiguous' },
    { ...anthropicJudgments, model: 'untrusted' },
  ])('rejects unsafe structured values', async (judgments) => {
    await expect(
      setup(anthropicMessage(judgments)).adapter.classify(input, context()),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it.each([
    [401, 'invalid_credential'],
    [403, 'permission_denied'],
    [400, 'unsupported_schema'],
    [404, 'unsupported_model'],
    [429, 'rate_limited'],
    [503, 'provider_unavailable'],
  ] as const)('sanitizes HTTP %s', async (status, code) => {
    const { adapter, fetch } = setup({ secret: 'do not expose' }, status);
    await expect(adapter.classify(input, context())).rejects.toMatchObject({
      code,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('short circuits partial input and validates versions, models and limits', async () => {
    const { adapter, fetch } = setup();
    expect(
      (await adapter.classify({ ...input, extraction: 'partial' }, context()))
        .categories,
    ).toEqual([]);
    await expect(
      adapter.classify({ ...input, text: 'a'.repeat(8001) }, context()),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(
      adapter.classify({ ...input, promptVersion: '2' }, context()),
    ).rejects.toMatchObject({ code: 'unsupported_schema' });
    await expect(
      adapter.classify(input, { ...context(), model: 'other' }),
    ).rejects.toMatchObject({ code: 'unsupported_model' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects malformed and oversized streams and invalid usage', async () => {
    for (const body of [
      '{',
      'a'.repeat(32769),
      JSON.stringify({
        ...anthropicMessage(),
        usage: { input_tokens: -1, output_tokens: 1 },
      }),
    ]) {
      const adapter = createAnthropicAdapter({
        fetch: async () => new Response(body),
      });
      await expect(adapter.classify(input, context())).rejects.toMatchObject({
        code: 'invalid_response',
      });
    }
  });
  it('cancels before and during network', async () => {
    const controller = new AbortController();
    controller.abort();
    const { adapter, fetch } = setup();
    await expect(
      adapter.classify(input, { ...context(), signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetch).not.toHaveBeenCalled();
    const pending = new AbortController();
    const other = createAnthropicAdapter({
      fetch: async () => {
        pending.abort();
        throw new Error('secret');
      },
    });
    await expect(
      other.classify(input, { ...context(), signal: pending.signal }),
    ).rejects.toMatchObject({ code: 'cancelled' });
  });
});
