import { defineContentScript } from 'wxt/utils/define-content-script';

// This entrypoint intentionally performs no extraction or page modification.
export default defineContentScript({
  matches: ['https://www.linkedin.com/feed/*'],
  main() {},
});
