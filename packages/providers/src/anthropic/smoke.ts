import type { NetworkClient } from '@clearedin/contracts';
import { PROMPT_VERSION, TAXONOMY_VERSION } from '@clearedin/taxonomy';
import { ANTHROPIC_CAPABILITIES, createAnthropicAdapter } from './index';

/** Exactly one synthetic paid request, only after explicit opt-in; never prints secrets or bodies. */
export async function runAnthropicSmoke(options: {
  optIn: boolean;
  credential: string;
  network: NetworkClient;
  signal?: AbortSignal;
}) {
  if (options.optIn !== true)
    throw new Error('Live smoke requires explicit opt-in.');
  const deadline = AbortSignal.timeout(10_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, deadline])
    : deadline;
  const result = await createAnthropicAdapter(options.network).classify(
    {
      requestId: 'anthropic-synthetic-smoke',
      text: 'We are hiring a backend engineer. I can refer applicants.',
      extraction: 'complete',
      taxonomyVersion: TAXONOMY_VERSION,
      promptVersion: PROMPT_VERSION,
    },
    {
      model: ANTHROPIC_CAPABILITIES.model,
      credential: options.credential,
      signal,
    },
  );
  return {
    provider: result.provider,
    model: result.model,
    sufficiency: result.sufficiency,
    categoryCount: result.categories.length,
    usage: result.usage,
  };
}
