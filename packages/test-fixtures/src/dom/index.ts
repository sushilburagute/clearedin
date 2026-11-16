/** Wholly synthetic markup matching documented selector assumptions, never captured feed data. */
export const SYNTHETIC_FEED_HTML = `<!doctype html><html><body>
  <main><div role="feed">
    <article class="feed-shared-update-v2" data-urn="urn:li:activity:1001" style="color: navy;" aria-hidden="false">
      <div class="update-components-actor"><span>Synthetic Author</span><span class="update-components-actor__sub-description">Sponsored</span></div>
      <div class="update-components-text"><p>Our synthetic compiler is ready.</p><p>Read the parser benchmarks <a href="https://example.invalid/?tracking=private">in this article</a>.</p><span hidden>Hidden draft</span><button>See controls</button></div>
      <div class="feed-shared-article__title">Synthetic parser benchmarks</div>
      <div class="comments-comments-list"><div class="comments-comment-item"><span class="update-components-text">Private synthetic comment</span></div></div>
      <div class="social-details-social-counts">999 reactions</div>
    </article>
  </div></main>
  <aside class="msg-overlay-list-bubble">Synthetic private message</aside>
</body></html>`;

export const SYNTHETIC_REPOST_HTML = `<!doctype html><html><body><main><div role="feed">
  <article class="feed-shared-update-v2" data-urn="urn:li:activity:1002">
    <div class="update-components-text">My synthetic release notes.</div>
    <div class="feed-shared-update-v2__reshared-content">
      <div class="update-components-actor">Synthetic Quoted Author</div>
      <div class="update-components-text">We shipped a compiler. Here are the benchmark methods.</div>
    </div>
  </article>
</div></main></body></html>`;
