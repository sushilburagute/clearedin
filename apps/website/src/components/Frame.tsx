import type { ReactNode } from 'react';
import { Icon } from './Icon';

export const guides = [
  ['how-it-works', 'How it works'],
  ['install', 'Installation'],
  ['setup', 'Provider setup'],
  ['privacy', 'Privacy'],
  ['support', 'FAQ & support'],
  ['changelog', 'Changelog'],
] as const;

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="ClearedIn home">
      <span className="brand-mark">
        <Icon name="layers" size={24} />
      </span>
      ClearedIn
    </a>
  );
}

export function Frame({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const links = [
    ['/', 'Feed studio'],
    ['/demo/', 'Full demo'],
    ['/how-it-works/', 'How it works'],
    ['/support/', 'Support'],
  ] as const;
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Main navigation">
            {links.map(([href, label]) => (
              <a
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <a
            href="/install/"
            className="btn btn-outline header-action"
            aria-current={path === '/install/' ? 'page' : undefined}
          >
            Get extension
          </a>
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        {children}
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <Brand />
            <p>
              Development preview. Independent of LinkedIn.
              <br />
              The website uses sample posts. Store listings are pending.
            </p>
          </div>
          <nav aria-label="More information">
            {guides.map(([slug, label]) => (
              <a key={slug} href={'/' + slug + '/'}>
                {label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
