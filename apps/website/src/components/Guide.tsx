import { pages } from '../content';
import { guides } from './Frame';
import { Icon } from './Icon';

export function Guide({ page }: { page: (typeof pages)[number] }) {
  const faq = page.slug === 'support';
  return (
    <div className="guide-layout">
      <aside className="guide-menu panel">
        <h2>
          <Icon name="book" /> Guides & support
        </h2>
        <nav aria-label="Guide pages">
          {guides.map(([slug, label]) => (
            <a
              href={'/' + slug + '/'}
              key={slug}
              aria-current={slug === page.slug ? 'page' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <article className="guide">
        <div className="guide-intro tile">
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          {page.slug === 'install' && (
            <div className="guide-actions">
              <a
                className="btn btn-blue"
                href="https://github.com/sushilburagute/clearedin/tree/main/apps/extension"
              >
                View extension source
              </a>
              <a
                className="btn btn-outline"
                href="https://github.com/sushilburagute/clearedin/archive/refs/heads/main.zip"
              >
                Download source ZIP
              </a>
            </div>
          )}
          {(faq || page.slug === 'privacy') && (
            <p>
              {faq ? 'For help, email ' : 'For privacy questions, email '}
              <a href="mailto:support@sush.dev">support@sush.dev</a> or send a
              direct message to{' '}
              <a href="https://x.com/sush_dev">@sush_dev on X</a>.
            </p>
          )}
        </div>
        <div className="guide-sections">
          {page.sections.map((section) =>
            faq ? (
              <details className="panel" key={section.title}>
                <summary>{section.title}</summary>
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </details>
            ) : (
              <section className="panel" key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </section>
            ),
          )}
        </div>
        <a className="btn btn-blue" href="/demo/">
          Try the full demo
        </a>
      </article>
    </div>
  );
}
export function MissingPage() {
  return (
    <div className="missing tile">
      <h1>Page not found</h1>
      <p>Return to the feed studio to explore the sample feed and its rules.</p>
      <a className="btn btn-blue" href="/">
        Back to feed studio
      </a>
    </div>
  );
}
