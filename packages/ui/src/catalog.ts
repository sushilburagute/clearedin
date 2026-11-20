import { PROVIDER_IDS, type ProviderId } from '@clearedin/contracts';

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

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  typesafe: 'TypeSafe Jev',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

export const UNAVAILABLE_PROVIDERS: readonly ProviderChoice[] =
  PROVIDER_IDS.map((id) => ({
    id,
    label: PROVIDER_LABELS[id],
    available: false,
    unavailableReason:
      'Provider integration and credential support are pending verification.',
    models: [],
    recipientId: PROVIDER_LABELS[id],
    retentionUrl: null,
    permissionLabel: 'Verified provider host',
  }));
