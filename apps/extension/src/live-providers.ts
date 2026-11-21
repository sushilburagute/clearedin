import type { ProviderId } from '@clearedin/contracts';
import { PROVIDER_CATALOG } from '@clearedin/providers/catalog';

function providerChoice(provider: ProviderId) {
  const entry = PROVIDER_CATALOG[provider];
  const origin = new URL(entry.endpoint).origin;
  return { ...entry, origin, recipientId: origin };
}

export const LIVE_PROVIDERS = {
  typesafe: providerChoice('typesafe'),
  openai: providerChoice('openai'),
  anthropic: providerChoice('anthropic'),
};

export const FIREFOX_DATA_PERMISSIONS = [
  'authenticationInfo',
  'websiteContent',
];

export function providerPermissions(provider: ProviderId) {
  return {
    origins: [LIVE_PROVIDERS[provider].origin + '/*'],
    ...(import.meta.env.BROWSER === 'firefox'
      ? { data_collection: [...FIREFOX_DATA_PERMISSIONS] }
      : {}),
  };
}
