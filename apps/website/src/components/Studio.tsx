import { useEffect, useRef, useState } from 'react';
import type { CategoryMode, CategoryId } from '@clearedin/contracts';
import type { DemoPolicy } from '../demo-policy';
import { Icon, type IconName } from './Icon';

export interface StudioPost {
  id: string;
  text: string;
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

function PreviewArt() {
  return (
    <div className="preview-art" aria-hidden="true">
      <div className="track track-one" />
      <div className="track track-two" />
      <div className="art-stack">
        <div className="art-sheet back-sheet" />
        <div className="art-sheet middle-sheet" />
        <div className="art-sheet front-sheet">
          <div className="art-byline">
            <span className="art-avatar">
              <Icon name="briefcase" size={23} />
            </span>
            <div>
              <b>Job postings</b>
              <i />
            </div>
            <span className="art-check">
              <Icon name="check" size={14} />
            </span>
          </div>
          <div className="art-lines">
            <i />
            <i />
          </div>
          <div className="art-rule">
            <Icon name="shield" size={13} />
            Always show
          </div>
        </div>
        <div className="art-muted">
          <Icon name="hide" size={17} />
          Engagement bait<span>Hidden</span>
        </div>
      </div>
    </div>
  );
}
export function StudioHero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>Choose what you see on LinkedIn.</h1>
        <p className="hero-description">
          Try it on a sample feed. Keep job openings visible, hide engagement
          bait, and bring back any post with a click.
        </p>
        <a className="btn btn-white" href="#studio">
          Try the sample feed <Icon name="arrow" size={17} />
        </a>
        <p className="hero-note">
          The browser extension is in development. This demo runs entirely on
          this page.
        </p>
      </div>
      <PreviewArt />
    </section>
  );
}

const modes = [
  ['show', 'Show normally'],
  ['hide', 'Hide'],
  ['always_show', 'Always show'],
] as const;
export function Studio({ posts }: StudioProps) {
  const [rules, setRules] = useState<Rules>({});
  const [revealed, setRevealed] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const focusAfterReveal = useRef<string | null>(null);
  const quickRules = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (quickRules.current && window.matchMedia('(max-width: 700px)').matches)
      quickRules.current.open = location.hash.startsWith('#quick-');
    setReady(true);
  }, []);
  useEffect(() => {
    if (focusAfterReveal.current) {
      document.getElementById('sample-' + focusAfterReveal.current)?.focus();
      focusAfterReveal.current = null;
    }
  }, [revealed]);
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
  return (
    <section className="studio" aria-labelledby="studio">
      <div className="studio-heading">
        <div>
          <h2 id="studio" tabIndex={-1}>
            Feed studio
          </h2>
          <p>
            Select <strong>Job hunt</strong> to hide engagement bait and keep
            job openings in view.
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
        <p className="notice">Enable JavaScript to change the sample feed.</p>
      </noscript>
      <div className="studio-grid">
        <div className="post-list">
          <div className="feed-line">
            <h3>Sample feed</h3>
            <span role="status">
              {posts.length - hidden} visible · {hidden} hidden
            </span>
          </div>
          {posts.map((p, i) => {
            const outcome = outcomes[i]!;
            const visibleLabel = revealed.includes(p.id)
              ? 'Revealed'
              : rules[p.category] === 'always_show'
                ? 'Always show'
                : 'Visible';
            return (
              <article
                key={p.id}
                tabIndex={-1}
                id={'sample-' + p.id}
                className={
                  'post panel tone-' +
                  p.icon +
                  (outcome.hidden ? ' collapsed' : '')
                }
              >
                <div className="post-top">
                  <span className="post-avatar">
                    <Icon name={p.icon} size={22} />
                  </span>
                  <div>
                    <h4>{p.label}</h4>
                    <span className="post-kind">
                      Synthetic post <span aria-hidden="true">·</span>{' '}
                      <Icon name="globe" size={12} />
                    </span>
                  </div>
                  {!outcome.hidden && (
                    <span className="state">
                      <Icon
                        name={
                          rules[p.category] === 'always_show' ? 'shield' : 'eye'
                        }
                        size={13}
                      />
                      {visibleLabel}
                    </span>
                  )}
                </div>
                {outcome.hidden ? (
                  <div className="hidden-row">
                    <span>{outcome.message}</span>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        focusAfterReveal.current = p.id;
                        setRevealed((prev) => [...prev, p.id]);
                      }}
                    >
                      Show this post
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="post-text">{p.text}</p>
                    {p.id === 'job-referral' && (
                      <div className="recruit-image">
                        <img
                          src="/studio.jpg"
                          alt="Sunlit meeting space with a long table and glass walls"
                          width="960"
                          height="641"
                        />
                        <div>
                          <span>Engineering team</span>
                          <strong>We’re hiring.</strong>
                        </div>
                      </div>
                    )}
                    <div className="post-bottom">
                      <span>
                        <Icon name={p.icon} size={14} />
                        {p.label}
                      </span>
                      <a
                        href={'#quick-' + p.category}
                        onClick={() => {
                          if (quickRules.current)
                            quickRules.current.open = true;
                        }}
                      >
                        <Icon name="sliders" size={14} />
                        Edit rule
                      </a>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
        <aside className="studio-aside">
          <details className="panel quick" ref={quickRules} open>
            <summary className="panel-title">
              <span className="title-icon">
                <Icon name="sliders" />
              </span>
              <h3>Quick rules</h3>
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
              Explore all 12 categories <Icon name="arrow" size={16} />
            </a>
          </details>
          <div className="privacy-note">
            <Icon name="shield" size={19} />
            <div>
              <strong>Private by design</strong>
              <p>
                This preview uses sample posts. Your choices stay in this tab.
              </p>
              <a href="/privacy/">How privacy works</a>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
