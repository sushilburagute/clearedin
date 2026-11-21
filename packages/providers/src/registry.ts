import type {
  ClassifierAdapter,
  NetworkClient,
  ProviderId,
} from '@clearedin/contracts';
import { createOpenAIAdapter, OPENAI_CAPABILITIES } from './openai';
import { createAnthropicAdapter, ANTHROPIC_CAPABILITIES } from './anthropic';
import { createTypeSafeAdapter, typesafeCapabilities } from './typesafe';

/** Availability here records acceptance for public release. The opt-in development
 * build also exposes the pinned adapters for end-to-end qualification. */
export const PROVIDER_REGISTRY = Object.freeze({
  typesafe: {
    model: typesafeCapabilities.model,
    adapterVersion: typesafeCapabilities.adapterVersion,
    endpoint: typesafeCapabilities.endpoint,
    available: false,
    reason:
      'Live endpoint, browser credentials, and calibration are unverified.',
  },
  openai: {
    model: OPENAI_CAPABILITIES.model,
    adapterVersion: OPENAI_CAPABILITIES.adapterVersion,
    endpoint: OPENAI_CAPABILITIES.endpoint,
    available: false,
    reason:
      'Client key custody decision, live access, and calibration are pending.',
  },
  anthropic: {
    model: ANTHROPIC_CAPABILITIES.model,
    adapterVersion: ANTHROPIC_CAPABILITIES.adapterVersion,
    endpoint: ANTHROPIC_CAPABILITIES.endpoint,
    available: false,
    reason:
      'Live endpoint, browser credentials, and calibration are unverified.',
  },
} as const);

// Keep the availability export used by earlier runtime integrations.
export const PROVIDER_AVAILABILITY = PROVIDER_REGISTRY;

/** Fixed-destination adapter used by the broker after the user selects a provider. */
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
