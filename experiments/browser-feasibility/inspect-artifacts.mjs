import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const output = resolve(directory, '.output');
const hashes = {};
for (const family of ['chrome', 'firefox']) {
  const root = resolve(output, `${family}-mv3`);
  const bytes = await readFile(resolve(root, 'manifest.json'));
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions ?? [], []);
  assert.deepEqual(manifest.optional_host_permissions, [
    'https://example.com/*',
  ]);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(
    manifest.content_security_policy.extension_pages,
    "script-src 'self'; object-src 'self'",
  );
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, [
    'http://127.0.0.1/feed/*',
  ]);
  assert.equal(manifest.content_scripts[0].all_frames, true);
  if (family === 'chrome') {
    assert.equal(manifest.background.service_worker, 'background.js');
    assert.equal(manifest.background.scripts, undefined);
  } else {
    assert.deepEqual(manifest.background.scripts, ['background.js']);
    assert.equal(manifest.background.service_worker, undefined);
    assert.equal(
      manifest.browser_specific_settings.gecko.id,
      'browser-probe@clearedin.invalid',
    );
  }
  const content = await readFile(
    resolve(root, 'content-scripts/content.js'),
    'utf8',
  );
  assert.equal(
    content.includes('synthetic-only-not-a-provider-key'),
    false,
    'Dummy value must stay out of content bundle',
  );
  hashes[`${family}-manifest`] = createHash('sha256')
    .update(bytes)
    .digest('hex');
  const archives = (await readdir(output)).filter((name) =>
    name.endsWith(`-${family}.zip`),
  );
  assert.equal(archives.length, 1);
  hashes[archives[0]] = createHash('sha256')
    .update(await readFile(resolve(output, archives[0])))
    .digest('hex');
  console.log(
    `${family}: manifest and content-bundle checks passed; ZIP hash recorded (not ZIP byte-parity verification).`,
  );
}
await mkdir(resolve(directory, 'results'), { recursive: true });
await writeFile(
  resolve(directory, 'results/artifacts.json'),
  JSON.stringify(hashes, null, 2) + '\n',
);
