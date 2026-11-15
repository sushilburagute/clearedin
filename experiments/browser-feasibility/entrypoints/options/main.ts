import { browser } from 'wxt/browser';

const report = document.querySelector<HTMLElement>('#report')!;
async function snapshot() {
  report.textContent = JSON.stringify(
    await browser.runtime.sendMessage({ type: 'PROBE_SNAPSHOT' }),
  );
}
document.querySelector('#seed')!.addEventListener('click', async () => {
  await browser.runtime.sendMessage({
    protocolVersion: 1,
    requestId: 'synthetic-options',
    type: 'SET_CREDENTIAL',
    provider: 'openai',
    credential: 'synthetic-only-not-a-provider-key',
  });
  await snapshot();
});
document.querySelector('#clear')!.addEventListener('click', async () => {
  await browser.runtime.sendMessage({
    protocolVersion: 1,
    requestId: 'synthetic-options',
    type: 'CLEAR_DATA',
  });
  await snapshot();
});
document.querySelector('#snapshot')!.addEventListener('click', snapshot);
document.querySelector('#grant')!.addEventListener('click', async () => {
  // Keep the permission request directly in the user gesture; no fetch follows.
  await browser.permissions.request({ origins: ['https://example.com/*'] });
  await snapshot();
});
document.querySelector('#revoke')!.addEventListener('click', async () => {
  await browser.permissions.remove({ origins: ['https://example.com/*'] });
  await snapshot();
});
await snapshot();
