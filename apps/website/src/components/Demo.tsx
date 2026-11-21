import {
  CATEGORY_DEFINITIONS,
  type CategoryDefinition,
} from '@clearedin/taxonomy';
import { SYNTHETIC_FIXTURES } from '@clearedin/test-fixtures/fake-classifier';
import { Icon } from './Icon';
import type { DemoPolicy } from '../demo-policy';

function CategoryRule({ category }: { category: CategoryDefinition }) {
  return (
    <div className="quick-rule">
      <label htmlFor={'rule-' + category.id}>{category.label}</label>
      <select
        id={'rule-' + category.id}
        data-category={category.id}
        aria-describedby={'help-' + category.id}
        disabled
      >
        <option value="show">Show normally</option>
        <option value="hide">Hide</option>
        <option value="always_show">Always show</option>
      </select>
      <small id={'help-' + category.id}>{category.definition}</small>
    </div>
  );
}

export function Demo({
  policies,
}: {
  policies: ReadonlyMap<string, DemoPolicy>;
}) {
  const isIntroRule = ({ id }: CategoryDefinition) =>
    id === 'job_posting' || id === 'referral';
  const introRules = CATEGORY_DEFINITIONS.filter(isIntroRule);
  const otherRules = CATEGORY_DEFINITIONS.filter((c) => !isIntroRule(c));
  const posts = [
    ...SYNTHETIC_FIXTURES.map((f, i) => ({
      id: f.id,
      title:
        f.id === 'job-referral'
          ? 'Job opening with a referral'
          : 'Sample post ' + (i + 1),
      body: f.text.replace('[Synthetic example] ', ''),
    })),
    {
      id: 'sponsored',
      title: 'Synthetic sponsored post',
      body: 'Sponsored: Explore our imaginary developer course.',
    },
  ];
  return (
    <div className="full-demo">
      <header className="demo-intro tile">
        <h1>Try your feed rules</h1>
        <p>
          Explore 12 categories on 14 fictional posts. Try setting Job postings
          to Hide, then select Always show for Referrals to bring the first post
          back.
        </p>
      </header>
      <noscript>
        <p className="notice">
          Enable JavaScript to change rules. All sample posts remain visible.
        </p>
      </noscript>
      <div className="demo-layout">
        <section className="demo-controls panel" aria-labelledby="demo-rules">
          <div className="panel-title">
            <span className="title-icon">
              <Icon name="sliders" />
            </span>
            <h2 id="demo-rules" tabIndex={-1}>
              Category rules
            </h2>
          </div>
          <p>
            Always show wins over Hide. Show normally lets other matching rules
            apply. Changes stay in this tab.
          </p>
          {introRules.map((c) => (
            <CategoryRule category={c} key={c.id} />
          ))}
          <details className="other-rules">
            <summary>Explore the other {otherRules.length} categories</summary>
            {otherRules.map((c) => (
              <CategoryRule category={c} key={c.id} />
            ))}
          </details>
          <div className="demo-toolbar">
            <p id="demo-status" role="status">
              All posts start visible.
            </p>
            <a id="feed-jump" href="#demo-feed">
              Sample feed
            </a>
            <div className="toolbar-buttons">
              <button
                id="pause"
                className="btn btn-primary"
                type="button"
                disabled
              >
                Pause demo
              </button>
              <button
                id="reset"
                className="btn btn-outline"
                type="button"
                disabled
              >
                Reset demo
              </button>
            </div>
          </div>
        </section>
        <section aria-labelledby="demo-feed" className="full-feed">
          <h2 id="demo-feed" tabIndex={-1}>
            Sample feed
          </h2>
          <p className="section-intro">
            These posts have fixed labels. The development extension uses your
            provider to classify live posts and skips recognized sponsored
            posts.
          </p>
          {posts.map((post) => (
            <article
              className="demo-post panel"
              key={post.id}
              id={'post-' + post.id}
              tabIndex={-1}
              data-fixture={post.id === 'sponsored' ? undefined : post.id}
              data-sponsored={post.id === 'sponsored' ? '' : undefined}
              data-policy={JSON.stringify(policies.get(post.id))}
              aria-labelledby={'title-' + post.id}
            >
              <div className="post-top">
                <span className="post-avatar">
                  <Icon name="feed" />
                </span>
                <h3 id={'title-' + post.id}>{post.title}</h3>
              </div>
              <p data-body>{post.body}</p>
              <span data-reason>Visible</span>
              <button
                className="link"
                type="button"
                data-reveal
                aria-describedby={'title-' + post.id}
                hidden
              >
                Show this post
              </button>
            </article>
          ))}
          <a href="#demo-rules">Back to category rules</a>
        </section>
      </div>
    </div>
  );
}
