import { REMOTE_CATEGORY_IDS } from '@clearedin/contracts';
export function typeSafeResponse() {
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
