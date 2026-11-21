import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseHTML } from 'linkedom';

const root = path.resolve('apps/website/dist');
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(file) : [file]));
  }
  return files;
}
const pages = (await walk(root)).filter((file) => file.endsWith('.html'));
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const { document } = parseHTML(html);
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.querySelectorAll('main').length, 1, file);
  assert.equal(document.querySelectorAll('h1').length, 1, file);
  assert(
    document.querySelector('title')?.textContent?.includes('ClearedIn'),
    file,
  );
  assert(
    document.querySelector('meta[name="description"]')?.getAttribute('content'),
    file,
  );
  assert(html.includes('Public demo with fictional posts'), file);
  assert(
    !document.querySelector('input[type="password"]'),
    'Website must not collect keys',
  );
  const ids = [...document.querySelectorAll('[id]')].map((node) => node.id);
  assert.equal(new Set(ids).size, ids.length, `Duplicate ID in ${file}`);
  for (const node of document.querySelectorAll('[href], [src]')) {
    const target = node.getAttribute('href') ?? node.getAttribute('src');
    const url = new URL(
      target,
      `https://preview.invalid/${path.relative(root, file).replaceAll('\\', '/')}`,
    );
    if (url.origin !== 'https://preview.invalid') {
      if (node.tagName === 'LINK' && node.getAttribute('rel') === 'canonical') {
        const pathname =
          '/' +
          path
            .relative(root, file)
            .replaceAll('\\', '/')
            .replace(/index\.html$/, '');
        assert.equal(
          url.href,
          new URL(pathname, 'https://clearedin.sush.dev').href,
          file,
        );
        continue;
      }
      assert(node.tagName === 'A', `Remote asset in ${file}`);
      continue;
    }
    let resolved = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    assert(
      !path.relative(root, resolved).startsWith('..'),
      'Path escapes site',
    );
    if ((await stat(resolved)).isDirectory())
      resolved = path.join(resolved, 'index.html');
    await stat(resolved);
    if (url.hash) {
      const destination = parseHTML(await readFile(resolved, 'utf8')).document;
      assert(
        destination.getElementById(decodeURIComponent(url.hash.slice(1))),
        `Broken anchor ${target} in ${file}`,
      );
    }
  }
  for (const control of document.querySelectorAll('select, input, textarea')) {
    assert(
      control.id && document.querySelector(`label[for="${control.id}"]`),
      `Unlabelled control in ${file}`,
    );
  }
}
assert(pages.length >= 8, 'Required pages missing');
console.log(
  `${pages.length} static pages: local links/assets, anchors, metadata, labels, and preview notices passed. Manual visual/accessibility checks remain separate.`,
);
