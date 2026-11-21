import { SELECTORS } from '@clearedin/linkedin-adapter';

/** Starts only after consent. LinkedIn can insert or replace the feed after navigation. */
export function watchFeedRoot(
  document: Document,
  changed: (root: Element | null) => void,
): () => void {
  let current: Element | null = null;
  const refresh = () => {
    if (
      current?.isConnected &&
      current.matches(SELECTORS.feed) &&
      current.closest('main')
    )
      return;
    const next =
      document.querySelector('main [role="feed"]') ??
      document.querySelector('main .scaffold-finite-scroll__content');
    if (current !== next) {
      current = next;
      changed(next);
    }
  };
  // Avoid observing the entire document subtree for every scrolling mutation.
  const timer = setInterval(refresh, 400);
  refresh();
  return () => clearInterval(timer);
}
