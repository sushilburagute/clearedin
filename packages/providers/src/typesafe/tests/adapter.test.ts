import { describe, expect, it, vi } from 'vitest';
import { createTypeSafeAdapter, TYPESAFE_MODEL } from '../index';
import { REMOTE_CATEGORY_IDS } from '@clearedin/contracts';
function typeSafeResponse() {
  return {
    model: 'jev-1.14.0',
    answers: Object.fromEntries([
      ...REMOTE_CATEGORY_IDS.map((id) => [
        id,
        {
          type: 'noul',
          noul: id === 'job_posting' || id === 'referral' ? 0.98 : 0.1,
        },
      ]),
      ['sufficiency', { type: 'noul', noul: 0.99 }],
    ]),
    usage: { input_tokens: 123, output_tokens: 12 },
  };
}

const input = {
  requestId: 'test',
  text: 'We are hiring engineers; ask for a referral.',
  extraction: 'complete' as const,
  taxonomyVersion: '1.0.0',
  promptVersion: '1.0.0',
};
const context = () => ({
  model: TYPESAFE_MODEL,
  credential: 'synthetic-key',
  signal: new AbortController().signal,
});
describe('TypeSafe typed adapter', () => {
  it('cancels a stalled response read on abort', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const promise = createTypeSafeAdapter({
      fetch: async () => new Response(stream),
    }).classify(input, { ...context(), signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('sends twelve independent typed questions and preserves multi-label membership', async () => {
    const fetch = vi.fn(async () => Response.json(typeSafeResponse()));
    const result = await createTypeSafeAdapter({ fetch }).classify(
      input,
      context(),
    );
    expect(
      result.categories.filter((c) => c.score >= 0.9).map((c) => c.id),
    ).toEqual(['job_posting', 'referral']);
    expect(result.usage).toEqual({
      inputTokens: 123,
      outputTokens: 12,
      questions: 12,
    });
    const call = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('https://api.typesafe.ai/v1/systemone');
    expect(call[1]).toMatchObject({ redirect: 'error', credentials: 'omit' });
    const body = JSON.parse(call[1].body as string);
    expect(Object.keys(body.questions)).toHaveLength(12);
    expect(
      Object.values(body.questions).every(
        (q) => (q as { type: string }).type === 'noul',
      ),
    ).toBe(true);
    expect(body.state.post_text).toBe(input.text);
  });
  it.each([0, 0.5, 0.89])('abstains on sufficiency %s', async (score) => {
    const data = typeSafeResponse();
    data.answers.sufficiency = { type: 'noul', noul: score };
    expect(
      await createTypeSafeAdapter({
        fetch: async () => Response.json(data),
      }).classify(input, context()),
    ).toMatchObject({ sufficiency: 'insufficient', categories: [] });
  });
  it.each([null, -1, 1.1, '0.9'])('rejects invalid Noul %s', async (value) => {
    const data = typeSafeResponse();
    Object.assign(data.answers.job_posting!, { noul: value });
    await expect(
      createTypeSafeAdapter({
        fetch: async () => Response.json(data),
      }).classify(input, context()),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it.each([401, 403, 429, 500, 422])('sanitizes HTTP %s', async (status) => {
    await expect(
      createTypeSafeAdapter({
        fetch: async () => new Response('secret body', { status }),
      }).classify(input, context()),
    ).rejects.not.toThrow('secret body');
  });
  it.each(['{', 'x'.repeat(32769)])(
    'rejects malformed or oversized bodies',
    async (body) => {
      await expect(
        createTypeSafeAdapter({
          fetch: async () => new Response(body),
        }).classify(input, context()),
      ).rejects.toMatchObject({ code: 'invalid_response' });
    },
  );
  it('does not dispatch partial input or aborted work', async () => {
    const fetch = vi.fn();
    const adapter = createTypeSafeAdapter({ fetch });
    expect(
      await adapter.classify({ ...input, extraction: 'partial' }, context()),
    ).toMatchObject({ categories: [], sufficiency: 'insufficient' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapter.classify(input, { ...context(), signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
