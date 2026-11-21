import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = new URL('../dist/', import.meta.url);
const files = fs
  .readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith('.html'));
assert.equal(files.length, 9);
for (const file of files) {
  const html = fs.readFileSync(
    new URL(file.replaceAll(path.sep, '/'), root),
    'utf8',
  );
  assert.match(html, /lang="en"/);
  assert.match(html, /name="description"/);
  assert.match(html, /name="viewport"/);
  const shouldIndex =
    process.env.VERCEL_ENV === 'production' && file !== '404.html';
  assert.equal(
    /<meta name="robots" content="noindex"/.test(html),
    !shouldIndex,
    file,
  );
  assert.match(html, /Skip to content/);
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
