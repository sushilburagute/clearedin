import { browser } from 'wxt/browser';
import type { OptionsRequest, RequestMessage } from '@clearedin/contracts';
import { createMessageClient } from './client';

export function createRuntimeClient<
  Allowed extends RequestMessage = OptionsRequest,
>() {
  // Firefox hosts background.scripts in its generated event page. Chromium runs our worker file.
  const backgroundUrl = new URL(
    import.meta.env.BROWSER === 'firefox'
      ? '_generated_background_page.html'
      : 'background.js',
    browser.runtime.getURL('/'),
  ).href;
  return createMessageClient<Allowed>({
    sendMessage: (message) => browser.runtime.sendMessage(message),
    subscribe(listener) {
      const receive = (
        message: unknown,
        sender: { id?: string; tab?: unknown; url?: string },
      ) => {
        if (
          sender.id === browser.runtime.id &&
          !sender.tab &&
          sender.url === backgroundUrl
        )
          listener(message);
      };
      browser.runtime.onMessage.addListener(receive);
      return () => browser.runtime.onMessage.removeListener(receive);
    },
  });
}
