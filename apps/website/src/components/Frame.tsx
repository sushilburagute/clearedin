import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

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
  const links: [string, string, IconName][] = [
    ['/', 'Feed studio', 'feed'],
    ['/how-it-works/', 'How it works', 'book'],
    ['/support/', 'Support', 'help'],
  ];
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="container header-inner">
          <Brand />
          <nav aria-label="Main navigation">
            {links.map(([href, label, icon]) => (
              <a
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
              >
                <Icon name={icon} size={18} />
                {label}
              </a>
            ))}
          </nav>
          <a href="/demo/" className="btn btn-blue header-action">
            Full demo <Icon name="arrow" size={16} />
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
              Live filtering and store installation are unavailable.
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
