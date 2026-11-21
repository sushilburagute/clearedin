import type { CategoryId } from '@clearedin/contracts';
import type { DemoPolicy } from '../demo-policy';
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
  const cards = posts.map((p) => {
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
        className={'post panel tone-' + p.icon}
      >
        <div className="hidden-row" hidden>
          <span className="hidden-reason">
            <Icon name="hide" size={18} />
            <span data-reason />
          </span>
          <button
            type="button"
            className="link"
            data-reveal
            aria-describedby={'byline-' + p.id}
          >
            Show this post
          </button>
        </div>
        <div className="post-content">
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
            <span className="state" hidden />
          </div>
          <p className="post-text">{p.text}</p>
          {p.id === 'job-referral' && (
            <div className="recruit-image">
              <img
                src={image.src}
                srcSet={image.srcSet}
                sizes="auto, (max-width: 620px) 85vw, (max-width: 900px) 44vw, (max-width: 1040px) 55vw, 310px"
                alt=""
                width="960"
                height="641"
                loading="lazy"
                decoding="async"
              />
              <div>
                <span>Open role</span>
                <strong>Backend engineer</strong>
              </div>
            </div>
          )}
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
                {protect ? 'Always show this category' : 'Hide this category'}
              </span>
            </button>
          </div>
        </div>
      </article>
    );
  });
  const featuredPosts = cards.slice(0, 3);
  const morePosts = cards.slice(3);
  return (
    <div className="studio">
      <section className="hero" aria-labelledby="intro-title">
        <div className="tile hero-copy">
          <h1 id="intro-title">Shape a sample LinkedIn feed.</h1>
          <p className="hero-description">
            Keep job openings visible, hide engagement bait, and bring back any
            post.
          </p>
          <div className="hero-actions">
            <a className="btn btn-blue" href="#studio">
              Try the sample feed
            </a>
          </div>
          <p className="hero-note">No account or extension needed.</p>
        </div>
        <section className="tile showcase" aria-labelledby="studio">
          <div className="studio-heading">
            <div>
              <h2 id="studio" tabIndex={-1}>
                Sample feed
              </h2>
              <p>
                Try <strong>Job hunt</strong> on these fictional posts.
              </p>
            </div>
            <div className="presets" role="group" aria-label="Feed presets">
              <button type="button" id="job-hunt" aria-pressed={false} disabled>
                <Icon name="briefcase" size={16} />
                Job hunt
              </button>
              <button type="button" id="show-all" aria-pressed={true} disabled>
                <Icon name="grid" size={15} />
                Show all
              </button>
            </div>
          </div>
          <noscript>
            <p className="notice">
              Enable JavaScript to change the sample feed.
            </p>
          </noscript>
          <div className="feed-line">
            <span role="status">{posts.length} visible · 0 hidden</span>
            <a href="#quick-rules">Edit quick rules</a>
          </div>
          <div className="feed-posts featured-posts">{featuredPosts}</div>
          {morePosts.length > 0 && (
            <details className="more-posts">
              <summary>More sample posts</summary>
              <div className="feed-posts">{morePosts}</div>
            </details>
          )}
        </section>
      </section>
      <div className="studio-grid">
        <aside className="studio-aside">
          <details className="panel quick" open>
            <summary id="quick-rules" className="panel-title">
              <span className="title-icon">
                <Icon name="sliders" />
              </span>
              <h2>Quick rules</h2>
            </summary>
            <p>Choose how each category appears.</p>
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
                    defaultValue="show"
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
        </aside>
        <div className="tile demo-tile">
          <span className="tile-icon">
            <Icon name="sliders" size={22} />
          </span>
          <h2>All 12 category rules</h2>
          <a className="tile-link" href="/demo/">
            Explore the full demo
          </a>
        </div>
        <div className="tile privacy-tile">
          <span className="tile-icon">
            <Icon name="shield" size={22} />
          </span>
          <h2>Feed rules stay in this tab.</h2>
          <a className="tile-link" href="/privacy/">
            How privacy works
          </a>
        </div>
      </div>
    </div>
  );
}
