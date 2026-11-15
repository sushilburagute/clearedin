import { describe, expect, it } from 'vitest';
import {
  authorizeCanonical,
  isProbeCommand,
  senderSurface,
} from '../src/authorization.ts';

const options = 'chrome-extension://probe/options.html';
const sender = { extensionId: 'probe', url: options, tabId: 1, frameId: 0 };
const status = {
  protocolVersion: 1,
  requestId: 'probe-status',
  type: 'GET_PUBLIC_STATUS',
};
const credential = {
  protocolVersion: 1,
  requestId: 'probe-credential',
  type: 'SET_CREDENTIAL',
  provider: 'openai',
  credential: 'dummy',
};

describe('browser metadata and frozen schemas', () => {
  it('recognizes exact options page even when opened as a tab', () => {
    expect(senderSurface(sender, 'probe', options)).toBe('options');
    expect(authorizeCanonical('options', credential)).toBe(true);
  });
  it.each([
    { extensionId: 'other' },
    { url: options + '?surface=options' },
    { url: options + '#options' },
    { url: options + '/extra' },
    { frameId: 1 },
    { url: 'https://example.com/options.html' },
  ])('rejects spoofed options metadata %j', (change) => {
    expect(senderSurface({ ...sender, ...change }, 'probe', options)).toBe(
      'rejected',
    );
  });
  it('permits content status but denies options commands and payload impersonation', () => {
    expect(
      senderSurface(
        { ...sender, url: 'http://127.0.0.1:8765/feed/' },
        'probe',
        options,
      ),
    ).toBe('content');
    expect(authorizeCanonical('content', status)).toBe(true);
    expect(authorizeCanonical('content', credential)).toBe(false);
    expect(
      authorizeCanonical('content', { ...status, surface: 'options', sender }),
    ).toBe(false);
    expect(authorizeCanonical('rejected', status)).toBe(false);
  });
  it.each([
    { url: 'http://127.0.0.1:8765/feed/', frameId: 1 },
    { url: 'http://127.0.0.1:8765/feed/', tabId: null },
    { url: 'http://127.0.0.1:8765/feed/unsupported' },
    { url: 'http://localhost:8765/feed/' },
    { url: 'http://127.0.0.1:8766/feed/' },
    { url: 'http://127.0.0.1:8765/feed.evil/' },
  ])('rejects nonfixture/subframe content %j', (change) => {
    expect(senderSurface({ ...sender, ...change }, 'probe', options)).toBe(
      'rejected',
    );
  });
  it('keeps experiment commands strict and separate', () => {
    expect(isProbeCommand({ type: 'PROBE_SNAPSHOT' }, 'PROBE_SNAPSHOT')).toBe(
      true,
    );
    expect(
      isProbeCommand(
        { type: 'PROBE_SNAPSHOT', url: options },
        'PROBE_SNAPSHOT',
      ),
    ).toBe(false);
    expect(authorizeCanonical('content', { type: 'PROBE_SNAPSHOT' })).toBe(
      false,
    );
  });
});
