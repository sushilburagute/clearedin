import type { NetworkClient } from '@clearedin/contracts';
import {
  createOpenAIAdapter,
  OPENAI_CAPABILITIES,
  OpenAIProviderError,
} from './index';
/** Explicit opt-in, one synthetic request, no retries or logging. Caller supplies a securely obtained key. */
export async function runOpenAISmoke(options: {
  enabled: boolean;
  credential: string;
  network: NetworkClient;
}) {
  if (!options.enabled) return { status: 'skipped' as const };
  if (!options.credential.trim())
    return { status: 'pending_credential' as const };
  try {
    const result = await createOpenAIAdapter(options.network).classify(
      {
        requestId: 'openai-synthetic-smoke',
        text: 'We are hiring a backend engineer. Please refer interested candidates.',
        extraction: 'complete',
        taxonomyVersion: '1.0.0',
        promptVersion: '1.0.0',
      },
      {
        credential: options.credential,
        model: OPENAI_CAPABILITIES.model,
        signal: AbortSignal.timeout(10_000),
      },
    );
    return { status: 'passed' as const, usage: result.usage };
  } catch (error) {
    return {
      status: 'failed' as const,
      code:
        error instanceof OpenAIProviderError ? error.code : 'internal_error',
    };
  }
}
