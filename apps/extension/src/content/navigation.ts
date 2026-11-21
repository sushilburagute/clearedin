import { supportsFeedRoute } from '@clearedin/linkedin-adapter';

/** Observe committed SPA navigations. A page's navigate event can precede a redirect or cancellation. */
export function watchFeedNavigation(
  page: EventTarget & { location: { href: string }; navigation?: EventTarget },
  enter: () => () => void,
  signal: AbortSignal,
) {
  if (signal.aborted) return;
  let previous: string | undefined;
  let leave: (() => void) | undefined;
  let suspended = false;
  function stop() {
    previous = undefined;
    leave?.();
    leave = undefined;
  }
  function sync() {
    if (suspended || signal.aborted || previous === page.location.href) return;
    stop();
    previous = page.location.href;
    if (supportsFeedRoute(new URL(previous))) leave = enter();
  }
  page.addEventListener(
    'pagehide',
    () => {
      suspended = true;
      stop();
    },
    { signal },
  );
  page.addEventListener(
    'pageshow',
    () => {
      suspended = false;
      sync();
    },
    { signal },
  );
  if (page.navigation) {
    page.navigation.addEventListener('currententrychange', sync, { signal });
  } else {
    page.addEventListener('popstate', sync, { signal });
    page.addEventListener('hashchange', sync, { signal });
    const timer = setInterval(sync, 400);
    signal.addEventListener('abort', () => clearInterval(timer), {
      once: true,
    });
  }
  signal.addEventListener('abort', stop, { once: true });
  sync();
}
