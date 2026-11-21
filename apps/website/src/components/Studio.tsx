import type { CategoryId } from '@clearedin/contracts';
import type { DemoPolicy } from '../demo-policy';
import { jobHunt } from '../studio';
import { Icon, type IconName } from './Icon';

export interface StudioPost {
  id: string;
  text: string;
  author: string;
  role: string;
  label: string;
  category: CategoryId;
  policy: DemoPolicy;
  icon: IconName;
}
export interface StudioProps {
  posts: StudioPost[];
  image: { src: string; srcSet: string };
}

const modes = [
  ['show', 'Show normally'],
  ['hide', 'Hide'],
  ['always_show', 'Always show'],
] as const;

export function Studio({ posts, image }: StudioProps) {
  const examples = posts.map((post) => {
    const key = post.policy.categories
      .map((id) => jobHunt[id] ?? 'show')
      .join('/');
    return { post, initial: post.policy.outcomes[key]! };
  });
  const cards = examples.map(({ post: p, initial }) => {
    const protect =
      p.category === 'job_posting' || p.category === 'technical_content';
    return (
      <article
        key={p.id}
        tabIndex={-1}
        id={'sample-' + p.id}
        data-category={p.category}
        data-policy={JSON.stringify(p.policy)}
        aria-labelledby={'byline-' + p.id}
        className={
          'post panel tone-' + p.icon + (initial.hidden ? ' collapsed' : '')
        }
      >
        <div className="hidden-row" hidden={!initial.hidden}>
          <span className="hidden-reason">
            <Icon name="hide" size={18} />
            <span data-reason>{initial.message}</span>
          </span>
          <button
            type="button"
            className="link"
            data-reveal
            disabled
            aria-describedby={'byline-' + p.id}
          >
            Show post
          </button>
        </div>
        {initial.hidden && (
          <noscript>
            <details className="original-post">
              <summary>Read the original post</summary>
              <p>{p.text}</p>
            </details>
          </noscript>
        )}
        <div className="post-content" hidden={initial.hidden}>
          <div className="post-top">
            <span className="post-avatar" aria-hidden="true">
              {p.author
                .split(' ')
                .map((name) => name[0])
                .join('')}
            </span>
            <div>
              <h3 id={'byline-' + p.id}>{p.author}</h3>
              <span className="post-kind">{p.role}</span>
            </div>
            <span
              className="state"
              hidden={jobHunt[p.category] !== 'always_show'}
            >
              Always show
            </span>
          </div>
          {p.id === 'job-referral' && (
            <div className="recruit-image">
              <img
                src={image.src}
                srcSet={image.srcSet}
                sizes="(max-width: 700px) 60vw, 410px"
                alt=""
                width="960"
                height="641"
                loading="eager"
                decoding="async"
              />
              <div>
                <span>Open role</span>
                <strong>Backend engineer</strong>
              </div>
            </div>
          )}
          <p className="post-text">{p.text}</p>
          <div className="post-bottom">
            <a
              href={'#quick-' + p.category}
              aria-label={'Edit rule for ' + p.label}
            >
              <Icon name={p.icon} size={14} />
              {p.label}
            </a>
            <button
              type="button"
              className="link post-action"
              disabled
              data-mode={protect ? 'always_show' : 'hide'}
              aria-describedby={'byline-' + p.id}
            >
              <Icon name={protect ? 'shield' : 'hide'} size={15} />
              <span>
                {jobHunt[p.category] === 'always_show'
                  ? 'Remove protection'
                  : protect
                    ? 'Always show this category'
                    : 'Hide this category'}
              </span>
            </button>
          </div>
        </div>
      </article>
    );
  });
  const featuredPosts = cards.slice(0, 2);
  const morePosts = cards.slice(2);
  return (
    <div className="studio">
      <header className="intro">
        <h1>Choose what stays in your LinkedIn feed.</h1>
        <p>
          Job openings get buried under “comment below” posts. The ClearedIn
          desktop browser extension lets you hide engagement bait and keep the
          openings in view.
        </p>
      </header>
      <section className="workbench" aria-labelledby="studio">
        <div className="studio-aside">
          <h2>
            <Icon name="sliders" size={20} /> Feed controls
          </h2>
          <p>
            Job hunt hides engagement bait and protects openings. Select Show
            all to compare.
          </p>
          <div className="presets" role="group" aria-label="Feed presets">
            <button type="button" id="show-all" aria-pressed={false} disabled>
              Show all
            </button>
            <button type="button" id="job-hunt" aria-pressed={true} disabled>
              <Icon name="briefcase" size={16} /> Job hunt
            </button>
          </div>
          <details className="quick" open>
            <summary id="quick-rules" className="panel-title">
              <Icon name="sliders" size={18} /> Category rules
            </summary>
            <div className="rule-list">
              {posts.map((p) => (
                <div className="quick-rule" key={p.category}>
                  <label htmlFor={'quick-' + p.category}>
                    <Icon name={p.icon} size={16} />
                    {p.label}
                  </label>
                  <select
                    id={'quick-' + p.category}
                    disabled
                    defaultValue={jobHunt[p.category] ?? 'show'}
                  >
                    {modes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <a className="all-rules" href="/demo/">
              Explore all 12 categories
            </a>
          </details>
        </div>
        <div className="sample-stream">
          <div className="feed-line">
            <h2 id="studio" tabIndex={-1}>
              Sample feed
            </h2>
            <span role="status">
              {examples.filter(({ initial }) => initial.hidden).length} of{' '}
              {posts.length} posts hidden
            </span>
          </div>
          <p className="sample-note">
            Fictional posts. No account or key needed.
          </p>
          <noscript>
            <p className="notice">Enable JavaScript to change these rules.</p>
          </noscript>
          <div className="feed-posts">{featuredPosts}</div>
          <details className="more-posts">
            <summary>
              Two more posts &mdash; compiler launch and consulting offer
            </summary>
            <div className="feed-posts">{morePosts}</div>
          </details>
        </div>
      </section>
      <section className="rules-explainer" aria-labelledby="rule-heading">
        <div className="section-heading">
          <h2 id="rule-heading">What happens to a post?</h2>
          <a className="text-action" href="/demo/">
            Try all 12 categories
          </a>
        </div>
        <div className="mode-list">
          <article>
            <Icon name="eye" size={24} />
            <h3>Show normally</h3>
            <p>
              Every category starts here. A post stays in your feed unless
              another matching rule hides it.
            </p>
          </article>
          <article>
            <Icon name="hide" size={24} />
            <h3>Hide</h3>
            <p>
              A matching post folds into a small placeholder. See why it was
              hidden and reveal it in place.
            </p>
          </article>
          <article>
            <Icon name="shield" size={24} />
            <h3>Always show</h3>
            <p>
              Protect a category you care about. A referral can stay visible
              even when it also matches a category you hide.
            </p>
          </article>
        </div>
      </section>
      <section className="extension-note" aria-labelledby="extension-heading">
        <div>
          <p className="product-context">Development preview</p>
          <h2 id="extension-heading">Use ClearedIn on your own feed</h2>
          <p>
            Build the extension for desktop Chrome or Firefox. Both store
            listings are pending. Connect your own provider and give permission
            before it receives post text. Recognized sponsored posts stay
            visible.
          </p>
        </div>
        <div className="extension-actions">
          <a className="btn btn-primary" href="/install/">
            Build the extension
          </a>
          <a className="text-action" href="/privacy/">
            What your provider receives
          </a>
        </div>
      </section>
    </div>
  );
}
