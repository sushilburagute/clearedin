import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
const root = new URL('../dist/', import.meta.url);
const files = fs
  .readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith('.html'));
const production = process.env.VERCEL_ENV === 'production';
const site = 'https://clearedin.sush.dev';
const indexableUrls = [];
assert.equal(files.length, 9);
for (const file of files) {
  const html = fs.readFileSync(
    new URL(file.replaceAll(path.sep, '/'), root),
    'utf8',
  );
  assert.match(html, /lang="en"/);
  assert.match(html, /name="description"/);
  assert.match(html, /name="viewport"/);
  const shouldIndex = production && file !== '404.html';
  assert.equal(
    /<meta name="robots" content="noindex"/.test(html),
    !shouldIndex,
    file,
  );
  assert.match(html, /Skip to content/);
  const analyticsScripts =
    html.match(/<script\b[^>]*\bsrc="\/tag-manager\.js"/g) ?? [];
  assert.equal(analyticsScripts.length, production ? 1 : 0, file);
  const { document } = parseHTML(html);
  const meta = (name) =>
    document
      .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.getAttribute('content');
  const canonical = document
    .querySelector('link[rel="canonical"]')
    ?.getAttribute('href');
  if (file === '404.html') {
    assert.equal(canonical, undefined);
  } else {
    const expected = new URL(
      file.replaceAll(path.sep, '/').replace(/index\.html$/, ''),
      site,
    ).href;
    assert.equal(canonical, expected, file);
    indexableUrls.push(canonical);
    assert.equal(meta('og:url'), canonical);
    assert.equal(meta('twitter:card'), 'summary_large_image');
    for (const prefix of ['og', 'twitter']) {
      assert.equal(meta(prefix + ':title'), document.title);
      assert.equal(meta(prefix + ':description'), meta('description'));
      assert.equal(meta(prefix + ':image'), site + '/sample-feed.png');
      assert.ok(meta(prefix + ':image:alt'));
    }
  }
  assert.ok(document.querySelector('a[href="/privacy/#analytics"]'), file);
  if (file.replaceAll(path.sep, '/') === 'privacy/index.html') {
    assert.equal(
      Boolean(document.querySelector('#analytics-toggle')),
      production,
    );
    if (production) {
      const settings = new Map();
      let reloads = 0;
      const events = new Map();
      runInNewContext(
        fs.readFileSync(new URL('tag-manager.js', root), 'utf8'),
        {
          document,
          localStorage: {
            getItem: (key) => settings.get(key),
            setItem: (key, value) => settings.set(key, value),
            removeItem: (key) => settings.delete(key),
          },
          location: { reload: () => reloads++ },
          addEventListener: (name, callback) => events.set(name, callback),
        },
      );
      const tags = () => document.querySelectorAll('script[src^="https:"]');
      const toggle = document.querySelector('#analytics-toggle');
      assert.equal(tags().length, 0);
      toggle.click();
      events.get('pageshow')();
      assert.equal(tags().length, 1);
      assert.equal(
        tags()[0].src,
        'https://www.googletagmanager.com/gtm.js?id=GTM-NSJV8N2F',
      );
      toggle.click();
      assert.equal(reloads, 1);
      assert.equal(settings.size, 0);
    }
  }
  // Inline executable scripts and style blocks would be blocked by public/_headers.
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>|<style\b/i);
  assert.doesNotMatch(html, /type="password"|api[_-]?key/i);
  for (const [, href] of html.matchAll(/href="(\/[^"#]*)"/g)) {
    const target = href.endsWith('/') ? `${href}index.html` : href;
    assert.ok(
      fs.existsSync(new URL(target.slice(1), root)),
      `Broken link in ${file}: ${href}`,
    );
  }
}
const card = fs.readFileSync(new URL('sample-feed.png', root));
assert.equal(card.subarray(1, 4).toString(), 'PNG');
assert.equal(card.readUInt32BE(16), 1200);
assert.equal(card.readUInt32BE(20), 630);
const robots = fs.readFileSync(new URL('robots.txt', root), 'utf8');
const sitemap = new URL('sitemap.xml', root);
assert.equal(fs.existsSync(sitemap), production);
if (production) {
  assert.match(robots, /^Allow: \/$/m);
  assert.ok(robots.includes('Sitemap: ' + site + '/sitemap.xml'));
  const listed = [
    ...fs.readFileSync(sitemap, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((match) => match[1]);
  assert.deepEqual(listed.sort(), indexableUrls.sort());
} else {
  assert.match(robots, /^Disallow: \/$/m);
  assert.doesNotMatch(robots, /Sitemap:/);
}
const scripts = fs
  .readdirSync(new URL('_astro/', root))
  .filter((file) => file.endsWith('.js'));
assert.ok(scripts.length > 0, 'Demo must bundle its script');
for (const file of scripts) {
  const js = fs.readFileSync(new URL(`_astro/${file}`, root), 'utf8');
  assert.doesNotMatch(
    js,
    /api\.openai\.com|api\.anthropic\.com|api\.typesafe|XMLHttpRequest|\bfetch\s*\(|WebSocket|localStorage/,
  );
}
console.log(
  `Website static checks passed: ${files.length} pages, internal links, metadata and offline bundle.`,
);
