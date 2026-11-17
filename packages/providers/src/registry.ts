import type {
  ClassifierAdapter,
  NetworkClient,
  ProviderId,
} from '@clearedin/contracts';
import { createOpenAIAdapter, OPENAI_CAPABILITIES } from './openai';
import { createAnthropicAdapter, ANTHROPIC_CAPABILITIES } from './anthropic';
import { createTypeSafeAdapter, typesafeCapabilities } from './typesafe';

/** Component capabilities are not production approval. No provider is enabled yet. */
export const PROVIDER_REGISTRY = Object.freeze({
  typesafe: {
    model: typesafeCapabilities.model,
    endpoint: typesafeCapabilities.endpoint,
    available: false,
    reason:
      'Live endpoint, browser credentials, and calibration are unverified.',
  },
  openai: {
    model: OPENAI_CAPABILITIES.model,
    endpoint: OPENAI_CAPABILITIES.endpoint,
    available: false,
    reason:
      'Client key custody decision, live access, and calibration are pending.',
  },
  anthropic: {
    model: ANTHROPIC_CAPABILITIES.model,
    endpoint: ANTHROPIC_CAPABILITIES.endpoint,
    available: false,
    reason:
      'Live endpoint, browser credentials, and calibration are unverified.',
  },
} as const);

/** Explicit component-test factory. Production must also satisfy the registry gates. */
export function createProviderAdapter(
  provider: ProviderId,
  network: NetworkClient,
): ClassifierAdapter {
  const endpoint = PROVIDER_REGISTRY[provider]?.endpoint;
  if (!endpoint) throw new Error('unsupported_provider');
  const restricted: NetworkClient = {
    fetch(url, init) {
      if (url !== endpoint || init.method !== 'POST')
        return Promise.reject(new Error('invalid_request'));
      return network.fetch(url, {
        ...init,
        redirect: 'error',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    },
  };
  switch (provider) {
    case 'typesafe':
      return createTypeSafeAdapter(restricted);
    case 'openai':
      return createOpenAIAdapter(restricted);
    case 'anthropic':
      return createAnthropicAdapter(restricted);
  }
}
