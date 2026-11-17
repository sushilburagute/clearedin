import type { ProviderId } from '@clearedin/contracts';

/** No combination has accepted packaged-browser, custody and live quality evidence. */
export const PROVIDER_AVAILABILITY: Readonly<
  Record<ProviderId, { available: false; reason: string }>
> = {
  typesafe: {
    available: false,
    reason: 'Packaged browser and live quality evidence pending.',
  },
  openai: {
    available: false,
    reason: 'Client credential security decision and browser evidence pending.',
  },
  anthropic: {
    available: false,
    reason: 'Packaged browser and live quality evidence pending.',
  },
};
