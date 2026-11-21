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
  return (
    <section className="studio" aria-labelledby="studio">
      <div className="studio-heading">
        <div>
          <h2 id="studio" tabIndex={-1}>
            Feed studio
          </h2>
          <p>
            Try <strong>Job hunt</strong> or set a rule directly on a post.
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
            <h3>Fictional sample feed</h3>
            <span role="status">
              {posts.length - hidden} visible · {hidden} hidden
            </span>
          </div>
          {posts.map((p, i) => {
            const outcome = outcomes[i]!;
            const isRevealed = revealed.includes(p.id);
            const isProtected = rules[p.category] === 'always_show';
            const offerProtection =
              p.category === 'job_posting' ||
              p.category === 'technical_content';
            const suggestedMode = offerProtection ? 'always_show' : 'hide';
            const undoProtection = offerProtection && isProtected;
            return (
              <article
                key={p.id}
                tabIndex={-1}
                id={'sample-' + p.id}
                aria-labelledby={'byline-' + p.id}
                className={
                  'post panel tone-' +
                  p.icon +
                  (outcome.hidden ? ' collapsed' : '')
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
                        <h4 id={'byline-' + p.id}>{p.author}</h4>
                        <span className="post-kind">{p.role}</span>
                      </div>
                      {(isProtected || isRevealed) && (
                        <span className="state">
                          <Icon
                            name={isRevealed ? 'eye' : 'shield'}
                            size={13}
                          />
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
                          if (quickRules.current)
                            quickRules.current.open = true;
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
                          setRevealed((prev) =>
                            prev.filter((id) => id !== p.id),
                          );
                          setMode(
                            p.category,
                            undoProtection ? 'show' : suggestedMode,
                          );
                        }}
                      >
                        <Icon
                          name={offerProtection ? 'shield' : 'hide'}
                          size={15}
                        />
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
