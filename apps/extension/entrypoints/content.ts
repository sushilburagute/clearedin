import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentRequest } from '@clearedin/contracts';
import {
  createExperimentalThresholdProfile,
  createVisibilityEvaluator,
} from '@clearedin/decision-engine';
import {
  createLinkedInAdapter,
  supportsFeedRoute,
} from '@clearedin/linkedin-adapter';
import { createContentSession } from '../src/content/session';
import { watchFeedNavigation } from '../src/content/navigation';
import { watchFeedRoot } from '../src/content/watch-root';
import { LIVE_PROVIDERS } from '../src/live-providers';
import { createRuntimeClient } from '../src/messaging/runtime-client';

export default defineContentScript({
  matches: [
    'https://www.linkedin.com/feed',
    'https://www.linkedin.com/feed/',
    'https://www.linkedin.com/feed?*',
    'https://www.linkedin.com/feed/?*',
  ],
  allFrames: false,
  main(context) {
    if (window !== window.top) return;
    const supportedRoute = () => supportsFeedRoute(new URL(location.href));
    watchFeedNavigation(
      window,
      () => {
        const session = createContentSession({
          adapter: createLinkedInAdapter({ excludeSponsored: true }),
          client: createRuntimeClient<ContentRequest>(),
          evaluate: createVisibilityEvaluator({ allowExperimental: true }),
          thresholds({ provider, model }) {
            if (!provider || !model || LIVE_PROVIDERS[provider].model !== model)
              return null;
            return createExperimentalThresholdProfile(provider, model, {
              sponsored: null,
            });
          },
          supportedRoute,
          watchRoot: (changed) => watchFeedRoot(document, changed),
          requestId: () => crypto.randomUUID(),
        });
        void session.start();
        return session.dispose;
      },
      context.signal,
    );
  },
});
