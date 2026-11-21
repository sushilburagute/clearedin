import { useEffect, useRef, useState } from 'react';
import type { CategoryMode, CategoryId } from '@clearedin/contracts';
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
}
const focusModes: Partial<Record<CategoryId, CategoryMode>> = {
  job_posting: 'always_show',
  engagement_bait: 'hide',
  promotion: 'hide',
};
type Rules = Partial<Record<CategoryId, CategoryMode>>;

const modes = [
  ['show', 'Show normally'],
  ['hide', 'Hide'],
  ['always_show', 'Always show'],
] as const;
export function Studio({ posts }: StudioProps) {
  const [rules, setRules] = useState<Rules>({});
  const [revealed, setRevealed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const focusAfterAction = useRef<string | null>(null);
  const quickRules = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (quickRules.current && window.matchMedia('(max-width: 700px)').matches)
      quickRules.current.open = location.hash.startsWith('#quick-');
    setReady(true);
  }, []);
  useEffect(() => {
    if (focusAfterAction.current) {
      document.getElementById('sample-' + focusAfterAction.current)?.focus();
      focusAfterAction.current = null;
    }
  }, [revealed, rules]);
  const outcomes = posts.map((p) =>
    revealed.includes(p.id)
      ? p.policy.revealed
      : p.policy.outcomes[
          p.policy.categories.map((id) => rules[id] ?? 'show').join('/')
        ]!,
  );
  const hidden = outcomes.filter((o) => o.hidden).length;
  const hasRules = posts.some((p) => (rules[p.category] ?? 'show') !== 'show');
  const isJobHunt = posts.every(
    (p) => (rules[p.category] ?? 'show') === (focusModes[p.category] ?? 'show'),
  );
  function applyPreset(jobHunt: boolean) {
    setRules(jobHunt ? { ...focusModes } : {});
    setRevealed([]);
  }
  function setMode(id: CategoryId, mode: CategoryMode) {
    setRules((previous) => ({ ...previous, [id]: mode }));
  }
  const cards = posts.map((p, i) => {
    const outcome = outcomes[i]!;
    const isRevealed = revealed.includes(p.id);
    const isProtected = rules[p.category] === 'always_show';
    const offerProtection =
      p.category === 'job_posting' || p.category === 'technical_content';
    const suggestedMode = offerProtection ? 'always_show' : 'hide';
    const undoProtection = offerProtection && isProtected;
    return (
      <article
        key={p.id}
        tabIndex={-1}
        id={'sample-' + p.id}
        aria-labelledby={'byline-' + p.id}
        className={
          'post panel tone-' + p.icon + (outcome.hidden ? ' collapsed' : '')
        }
      >
        {outcome.hidden ? (
          <div className="hidden-row">
            <span className="hidden-reason">
              <Icon name="hide" size={18} />
              <span id={'byline-' + p.id}>{outcome.message}</span>
            </span>
            <button
              type="button"
              className="link"
              onClick={() => {
                focusAfterAction.current = p.id;
                setRevealed((prev) => [...prev, p.id]);
              }}
            >
              Show this post
            </button>
          </div>
        ) : (
          <>
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
              {(isProtected || isRevealed) && (
                <span className="state">
                  <Icon name={isRevealed ? 'eye' : 'shield'} size={13} />
                  {isRevealed ? 'Revealed' : 'Always show'}
                </span>
              )}
            </div>
            <p className="post-text">{p.text}</p>
            {p.id === 'job-referral' && (
              <div className="recruit-image">
                <img
                  src="/studio.jpg"
                  alt="Sunlit meeting space with a long table and glass walls"
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
                onClick={() => {
                  if (quickRules.current) quickRules.current.open = true;
                }}
              >
                <Icon name={p.icon} size={14} />
                {p.label}
              </a>
              <button
                type="button"
                className="link post-action"
                disabled={!ready}
                aria-describedby={'byline-' + p.id}
                onClick={() => {
                  focusAfterAction.current = p.id;
                  setRevealed((prev) => prev.filter((id) => id !== p.id));
                  setMode(p.category, undoProtection ? 'show' : suggestedMode);
                }}
              >
                <Icon name={offerProtection ? 'shield' : 'hide'} size={15} />
                {undoProtection
                  ? 'Remove protection'
                  : offerProtection
                    ? 'Always show this category'
                    : 'Hide this category'}
              </button>
            </div>
          </>
        )}
      </article>
    );
  });
  const featuredPosts = cards.slice(0, 3);
  const morePosts = cards.slice(3);
  return (
    <div className="studio">
      <section className="hero" aria-labelledby="intro-title">
        <div className="tile hero-copy">
          <h1 id="intro-title">Choose what you see on LinkedIn.</h1>
          <p className="hero-description">
            Try keeping job openings visible, hiding engagement bait, and
            bringing back any post with a click.
          </p>
          <div className="hero-actions">
            <a className="btn btn-blue" href="/install/">
              Get the extension
            </a>
            <a className="btn btn-outline" href="#studio">
              Try sample feed
            </a>
          </div>
          <p className="hero-note">Development build for Chrome and Firefox.</p>
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
              <button
                type="button"
                aria-pressed={isJobHunt}
                onClick={() => applyPreset(true)}
                disabled={!ready}
              >
                <Icon name="briefcase" size={16} />
                Job hunt
              </button>
              <button
                type="button"
                aria-pressed={!hasRules}
                onClick={() => applyPreset(false)}
                disabled={!ready}
              >
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
            <span role="status">
              {posts.length - hidden} visible · {hidden} hidden
            </span>
            <a
              href="#quick-rules"
              onClick={() => {
                if (quickRules.current) quickRules.current.open = true;
              }}
            >
              Edit quick rules
            </a>
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
        <aside className="studio-aside" id="quick-rules">
          <details className="panel quick" ref={quickRules} open>
            <summary className="panel-title">
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
                    disabled={!ready}
                    value={rules[p.category] ?? 'show'}
                    onChange={(event) =>
                      setMode(p.category, event.target.value as CategoryMode)
                    }
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
          <h2>Your choices stay in this tab.</h2>
          <a className="tile-link" href="/privacy/">
            How privacy works
          </a>
        </div>
      </div>
    </div>
  );
}
