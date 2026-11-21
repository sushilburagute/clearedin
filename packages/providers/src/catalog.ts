/** Public metadata shared by the settings UI, content policy and fixed API adapters. */
export const PROVIDER_CATALOG = {
  typesafe: {
    model: 'jev-1.14.0',
    endpoint: 'https://api.typesafe.ai/v1/systemone',
    label: 'TypeSafe Jev',
    retentionUrl: 'https://trust.typesafe.ai/',
  },
  openai: {
    model: 'gpt-5.6-terra',
    endpoint: 'https://api.openai.com/v1/responses',
    label: 'OpenAI',
    retentionUrl: 'https://developers.openai.com/api/docs/guides/your-data',
  },
  anthropic: {
    model: 'claude-haiku-4-5-20251001',
    endpoint: 'https://api.anthropic.com/v1/messages',
    label: 'Anthropic',
    retentionUrl:
      'https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data',
  },
} as const;
