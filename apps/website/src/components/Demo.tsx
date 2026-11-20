import { CATEGORY_DEFINITIONS } from '@clearedin/taxonomy';
import { SYNTHETIC_FIXTURES } from '@clearedin/test-fixtures/fake-classifier';
import { Icon } from './Icon';
import type { DemoPolicy } from '../demo-policy';

export function Demo({
  policies,
}: {
  policies: ReadonlyMap<string, DemoPolicy>;
}) {
  const posts = [
    ...SYNTHETIC_FIXTURES.map((f, i) => ({
      id: f.id,
      title: 'Synthetic post ' + (i + 1),
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
      <header className="demo-intro">
        <p className="overline">
          <Icon name="sliders" size={16} />
          Full demo
        </p>
        <h1>Build your feed rules.</h1>
        <p>
          Set Job postings to Hide, then protect Referrals with Always show.
          Watch what happens to the first post.
        </p>
      </header>
      <div className="demo-toolbar panel">
        <p id="demo-status" role="status">
          All posts start visible.
        </p>
        <a id="feed-jump" href="#demo-feed">
          Sample feed
        </a>
        <a href="#demo-rules">Rules</a>
        <div className="toolbar-buttons">
          <button id="pause" className="btn btn-blue" type="button" disabled>
            Pause demo
          </button>
          <button id="reset" className="btn btn-outline" type="button" disabled>
            Reset demo
          </button>
        </div>
      </div>
      <noscript>
        <p className="notice">
          Enable JavaScript to change rules. All sample posts remain visible.
        </p>
      </noscript>
      <div className="demo-layout">
        <section aria-labelledby="demo-feed" className="full-feed">
          <h2 id="demo-feed" tabIndex={-1}>
            Sample feed
          </h2>
          <p className="section-intro">
            14 fixed examples. Labels illustrate the rules and make no claim
            about model accuracy.
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
          {CATEGORY_DEFINITIONS.map((c) => (
            <div className="quick-rule" key={c.id}>
              <label htmlFor={'rule-' + c.id}>{c.label}</label>
              <select
                id={'rule-' + c.id}
                data-category={c.id}
                aria-describedby={'help-' + c.id}
                disabled
              >
                <option value="show">Show normally</option>
                <option value="hide">Hide</option>
                <option value="always_show">Always show</option>
              </select>
              <small id={'help-' + c.id}>{c.definition}</small>
            </div>
          ))}
          <a className="all-rules" href="#demo-feed">
            View sample feed <Icon name="arrow" size={16} />
          </a>
        </section>
      </div>
    </div>
  );
}
