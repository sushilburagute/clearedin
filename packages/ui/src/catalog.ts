import type { ProviderId } from '@clearedin/contracts';

/** Task 11 injects a verified catalog. No UI string defines a request endpoint. */
export interface ProviderChoice {
  id: ProviderId;
  label: string;
  available: boolean;
  unavailableReason: string;
  models: readonly { id: string; label: string }[];
  recipientId: string;
  retentionUrl: string | null;
  permissionLabel: string;
}

export const UNAVAILABLE_PROVIDERS: readonly ProviderChoice[] = [
  { id: 'typesafe' as const, label: 'TypeSafe Jev' },
  { id: 'openai' as const, label: 'OpenAI' },
  { id: 'anthropic' as const, label: 'Anthropic' },
].map((provider) => ({
  ...provider,
  available: false,
  unavailableReason:
    'Provider integration and credential support are pending verification.',
  models: [],
  recipientId: provider.label,
  retentionUrl: null,
  permissionLabel: 'Verified provider host',
}));
