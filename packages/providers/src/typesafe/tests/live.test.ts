import { expect, it } from 'vitest';
import { createTypeSafeAdapter, TYPESAFE_MODEL } from '../index';
it.skipIf(process.env.CLEAREDIN_LIVE_TYPESAFE !== '1')(
  'opt-in single synthetic live request',
  async () => {
    const credential = process.env.TYPESAFE_API_KEY;
    if (!credential)
      throw new Error('TYPESAFE_API_KEY required for opted-in smoke test');
    const result = await createTypeSafeAdapter({ fetch }).classify(
      {
        requestId: 'synthetic-smoke',
        text: 'We are hiring a software engineer. Contact our recruiting team.',
        extraction: 'complete',
        taxonomyVersion: '1.0.0',
        promptVersion: '1.0.0',
      },
      { credential, model: TYPESAFE_MODEL, signal: AbortSignal.timeout(10000) },
    );
    expect(result.provider).toBe('typesafe');
  },
  12000,
);
