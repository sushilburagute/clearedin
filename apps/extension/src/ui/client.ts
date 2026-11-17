import { browser } from 'wxt/browser';
import type { OptionsRequest } from '@clearedin/contracts';
import { createMessageClient } from '../messaging/client';

export function createRuntimeClient() {
  return createMessageClient<OptionsRequest>({
    sendMessage: (message) => browser.runtime.sendMessage(message),
    subscribe(listener) {
      const receive = (
        message: unknown,
        sender: { id?: string; tab?: unknown },
      ) => {
        if (sender.id === browser.runtime.id && !sender.tab) listener(message);
      };
      browser.runtime.onMessage.addListener(receive);
      return () => browser.runtime.onMessage.removeListener(receive);
    },
  });
}
