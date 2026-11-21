import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { inflateRawSync } from 'node:zlib';

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

// Read generated ZIP central directories, then compare uncompressed bytes to the
// inspected build. No extraction or path writes. ZIP64/encrypted files fail closed.
function zipEntries(bytes) {
  let end = bytes.length - 22;
  while (
    end >= Math.max(0, bytes.length - 65557) &&
    bytes.readUInt32LE(end) !== 0x06054b50
  )
    end--;
  assert(end >= 0, 'ZIP end record missing');
  const count = bytes.readUInt16LE(end + 10);
  assert(count !== 0xffff, 'ZIP64 is unsupported by this audit');
  let cursor = bytes.readUInt32LE(end + 16);
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 8) & 1, 0, 'Encrypted ZIP');
    const method = bytes.readUInt16LE(cursor + 10);
    const size = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const offset = bytes.readUInt32LE(cursor + 42);
    const name = bytes
      .subarray(cursor + 46, cursor + 46 + nameLength)
      .toString('utf8');
    assert(!entries.has(name), `Duplicate ZIP path ${name}`);
    assert(
      !name.startsWith('/') && !name.split('/').includes('..'),
      'Unsafe ZIP path',
    );
    assert.equal(bytes.readUInt32LE(offset), 0x04034b50);
    const start =
      offset +
      30 +
      bytes.readUInt16LE(offset + 26) +
      bytes.readUInt16LE(offset + 28);
    const compressed = bytes.subarray(start, start + size);
    assert(method === 0 || method === 8, 'Unsupported ZIP compression');
    if (!name.endsWith('/'))
      entries.set(name, method === 8 ? inflateRawSync(compressed) : compressed);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
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
  assert.deepEqual(manifest.optional_host_permissions ?? [], []);
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
    "script-src 'self'; object-src 'self'",
  );
  assert.deepEqual(
    manifest.content_scripts.flatMap((script) => script.matches),
    ['https://www.linkedin.com/feed/*'],
  );
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
