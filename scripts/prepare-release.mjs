import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { zip, zipEntries } from './release-zip.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(
  git('status', '--porcelain'),
  '',
  'Commit changes before preparing reviewer source.',
);
const sourceCommit = git('rev-parse', 'HEAD');
await mkdir('.release', { recursive: true });
const tree = git('ls-tree', '-rz', '--full-tree', sourceCommit)
  .split('\0')
  .filter(Boolean);
const source = execFileSync('git', ['archive', '--format=zip', sourceCommit], {
  env: { ...process.env, TZ: 'UTC' },
  maxBuffer: 64 * 1024 * 1024,
});
const files = zipEntries(source);
assert.equal(
  files.size,
  tree.length,
  'Reviewer ZIP must include every tracked file',
);
for (const entry of tree) {
  assert(
    /^100(?:644|755) blob /.test(entry),
    'Reviewer source requires regular tracked files',
  );
  const name = entry.slice(entry.indexOf('\t') + 1);
  assert(files.has(name));
  assert(
    !/(^|\/)(?:\.env(?:\.|$)|(?:node_modules|artifacts|\.release|\.output|dist)(?:\/|$))/.test(
      name,
    ),
    `Unexpected release input: ${name}`,
  );
}
const packageInfo = JSON.parse(
  await readFile('apps/extension/package.json', 'utf8'),
);
const namePrefix =
  packageInfo.name.replace(/[^a-z0-9-]/gi, '') + '-' + packageInfo.version;
const archives = ['chrome', 'firefox'].map(
  (browser) => namePrefix + '-' + browser + '.zip',
);
const generated = new Set([
  ...archives,
  'repository-source.zip',
  'website.zip',
  'inventory.json',
  'rebuild.json',
  'amo-validation.json',
]);
for (const name of await readdir('.release')) {
  assert(
    generated.has(name),
    'Move previous or unrelated .release/ outputs aside before preparing this version.',
  );
}
for (const name of ['inventory.json', 'rebuild.json', 'amo-validation.json']) {
  await rm(path.join('.release', name), { force: true });
}
await writeFile('.release/repository-source.zip', source);
const artifacts = [];
for (const name of archives) {
  const bytes = await readFile(`apps/extension/.output/${name}`);
  await writeFile(`.release/${name}`, bytes);
  artifacts.push({ file: name, sha256: sha256(bytes), bytes: bytes.length });
}
async function siteFiles(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory())
      result.push(
        ...(await siteFiles(path.join(directory, entry.name), `${name}/`)),
      );
    else
      result.push({
        name,
        bytes: await readFile(path.join(directory, entry.name)),
      });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}
const website = zip(await siteFiles('apps/website/dist'));
await writeFile('.release/website.zip', website);
artifacts.push(
  { file: 'website.zip', sha256: sha256(website), bytes: website.length },
  {
    file: 'repository-source.zip',
    sha256: sha256(source),
    bytes: source.length,
  },
);
const inventory = {
  schemaVersion: 1,
  status: 'development-only-not-approved-for-release',
  sourceCommit,
  dirtyWorkingTree: false,
  node: process.version,
  artifacts,
  sourceFiles: [...files].map(([file, bytes]) => ({
    file,
    sha256: sha256(bytes),
  })),
};
await writeFile(
  '.release/inventory.json',
  JSON.stringify(inventory, null, 2) + '\n',
);
console.log(
  `Prepared complete monorepo source, two development browser packages, website ZIP, and SHA-256 inventory in .release/. Source commit: ${sourceCommit}.`,
);
