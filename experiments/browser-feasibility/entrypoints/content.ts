import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { ReplyMessageSchema } from '@clearedin/contracts';
import { SESSION_KEY } from '../src/session.ts';
import { supportsFixture } from '../src/routes.ts';
import { runDomChecks, type Check } from '../src/dom.ts';

export default defineContentScript({
  // Firefox match patterns do not support a port. The runtime guard below and
  // browser sender authorization still require port 8765 and exact /feed/.
  matches: ['http://127.0.0.1/feed/*'],
  allFrames: true, // Adversarial iframe tests; not a production recommendation.
  async main() {
    const checks: Check[] = [];
    const check = (name: string, passed: boolean) =>
      checks.push({ name, passed });
    try {
      const envelope = { protocolVersion: 1, requestId: 'synthetic-content' };
      const status = await browser.runtime.sendMessage({
        ...envelope,
        type: 'GET_PUBLIC_STATUS',
      });
      if (
        !supportsFixture(globalThis.location.href) ||
        globalThis.top !== globalThis.self
      ) {
        check(
          'unsupported route or subframe denied',
          status?.type === 'PROBE_DENIED',
        );
      } else {
        check(
          'public status validates without secret fields',
          ReplyMessageSchema.safeParse(status).success &&
            status?.type === 'PUBLIC_STATUS',
        );
        check(
          'dummy seeded before content test',
          status?.status?.credentialConfigured === true,
        );
        const privileged = await browser.runtime.sendMessage({
          ...envelope,
          type: 'SET_CREDENTIAL',
          provider: 'openai',
          credential: 'untrusted-content-probe',
        });
        check(
          'content cannot set credential',
          privileged?.type === 'PROBE_DENIED',
        );
        for (const type of [
          'GET_SETTINGS',
          'CLEAR_DATA',
          'TEST_PROVIDER_CONNECTION',
        ]) {
          const reply = await browser.runtime.sendMessage({
            ...envelope,
            type,
          });
          check(
            `content cannot invoke ${type}`,
            reply?.type === 'PROBE_DENIED',
          );
        }
        const snapshot = await browser.runtime.sendMessage({
          type: 'PROBE_SNAPSHOT',
        });
        check(
          'content cannot retrieve trusted snapshot',
          snapshot?.type === 'PROBE_DENIED',
        );
        let readable = false;
        try {
          const data = await browser.storage.session.get(SESSION_KEY);
          readable = Object.hasOwn(data, SESSION_KEY);
        } catch {
          /* Denial or absent API is expected in an isolated content world. */
        }
        check('direct session read cannot retrieve dummy', !readable);
        checks.push(
          ...runDomChecks(document.querySelector<HTMLElement>('#fixture')!),
        );
      }
    } catch {
      check('content suite completed', false);
    }
    const report = document.createElement('pre');
    report.id = 'probe-content-report';
    report.textContent = JSON.stringify({
      context: 'packaged-content-script',
      checks,
    });
    document.body.append(report);
  },
});
