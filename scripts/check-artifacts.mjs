import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { zipEntries } from './release-zip.mjs';

async function filesUnder(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = resolve(root, entry.name);
        return entry.isDirectory() ? filesUnder(path) : [path];
      }),
    )
  ).flat();
}

const output = resolve('apps/extension/.output');
const archives = (await readdir(output)).filter(
  (name) => name.endsWith('.zip') && !name.includes('sources'),
);
for (const browser of ['chrome', 'firefox']) {
  const root = resolve(output, `${browser}-mv3`);
  const manifest = JSON.parse(
    await readFile(resolve(root, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions ?? [], ['storage']);
  assert.deepEqual(manifest.host_permissions ?? [], []);
  assert.deepEqual([...(manifest.optional_host_permissions ?? [])].sort(), [
    'https://api.anthropic.com/*',
    'https://api.openai.com/*',
    'https://api.typesafe.ai/*',
  ]);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.options_ui.open_in_tab, true);
  for (const size of [16, 32, 48, 128]) {
    const icon = `icon/${size}.png`;
    assert.equal(manifest.icons?.[size], icon);
    if (size <= 32) assert.equal(manifest.action.default_icon[size], icon);
    const png = await readFile(resolve(root, icon));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  assert.equal(manifest.update_url, undefined);
  assert.equal(
    manifest.content_security_policy.extension_pages,
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; connect-src https://api.typesafe.ai https://api.openai.com https://api.anthropic.com",
  );
  assert.deepEqual(
    manifest.content_scripts.flatMap((script) => script.matches).sort(),
    [
      'https://www.linkedin.com/feed',
      'https://www.linkedin.com/feed/',
      'https://www.linkedin.com/feed/?*',
      'https://www.linkedin.com/feed?*',
    ],
  );
  assert(manifest.content_scripts.every((script) => !script.all_frames));
  if (browser === 'chrome')
    assert.equal(typeof manifest.background.service_worker, 'string');
  else {
    assert.equal(
      manifest.browser_specific_settings.gecko.id,
      'development@clearedin.invalid',
    );
    assert.deepEqual(
      manifest.browser_specific_settings.gecko.data_collection_permissions
        .required,
      ['none'],
    );
    assert.deepEqual(
      manifest.browser_specific_settings.gecko.data_collection_permissions
        .optional,
      ['authenticationInfo', 'websiteContent'],
    );
    assert(
      Array.isArray(manifest.background.scripts),
      'Firefox requires its browser-specific background output',
    );
  }
  const archive = archives.filter((name) => name.includes(browser));
  assert.equal(archive.length, 1, `Expected one ${browser} ZIP`);
  const zipped = zipEntries(await readFile(resolve(output, archive[0])));
  const buildFiles = await filesUnder(root);
  assert.equal(zipped.size, buildFiles.length, 'ZIP/build file count differs');
  for (const path of buildFiles) {
    const name = relative(root, path).replaceAll('\\', '/');
    const bytes = await readFile(path);
    assert.deepEqual(
      zipped.get(name),
      bytes,
      `ZIP differs from build: ${name}`,
    );
    assert(
      !/\.(?:map|env)$/.test(name),
      `Unexpected sensitive/debug file ${name}`,
    );
    if (/\.(?:js|html|json)$/.test(name)) {
      const text = bytes.toString('utf8');
      assert(
        !/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/.test(text),
        `Possible credential in ${name}`,
      );
      assert(
        !/<script[^>]+src=["']https?:/i.test(text),
        `Remote script in ${name}`,
      );
      assert(
        !/(?:import\s*\(|importScripts\s*\()\s*["']https?:/.test(text),
        `Remote code import in ${name}`,
      );
    }
  }
  console.log(
    `${browser}: MV3 manifest, local code, basic secret-pattern checks, and ZIP/build parity passed.`,
  );
}
const website = await readFile(resolve('apps/website/dist/index.html'), 'utf8');
assert(
  website.includes('The extension is in development.'),
  'Website must accurately state extension availability',
);
assert(!/<script[^>]+src=["']https?:/i.test(website));
console.log(
  'Static website preview checked. This is an artifact audit, not a live browser or comprehensive security test.',
);
