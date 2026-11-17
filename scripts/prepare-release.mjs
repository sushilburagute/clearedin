import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';

// Deterministic, uncompressed ZIP: fixed timestamp, sorted paths, no symlinks,
// no Git metadata, no ignored output, no credentials or user's artifacts/.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; ++bit)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const local = [],
    directory = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const filename = Buffer.from(name);
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes);
    directory.push(central, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, central, end]);
}
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = process.cwd();
const listed = execFileSync(
  'git',
  ['ls-files', '-co', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const roots = new Set([
  'apps',
  'packages',
  'docs',
  'scripts',
  'tests',
  'experiments',
  '.github',
]);
const allowedRoot =
  /^(?:README\.md|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig.*\.json|vitest.*\.ts|eslint\.config\.mjs|\.node-version|\.nvmrc|\.npmrc|\.gitignore|\.prettierignore|\.prettierrc.*)$/;
const files = [];
for (const name of [...new Set(listed)].sort()) {
  if (!(roots.has(name.split('/')[0]) || allowedRoot.test(name))) continue;
  assert(!name.split('/').includes('..') && !path.isAbsolute(name));
  assert(
    !/(^|\/)\.env(?:\.|$)/.test(name) &&
      !/(^|\/)(?:node_modules|\.output|dist)(\/|$)/.test(name),
  );
  let info;
  try {
    info = await lstat(path.resolve(root, name));
  } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw error;
  }
  assert(!info.isSymbolicLink(), 'Source archive does not follow symlinks');
  const bytes = await readFile(path.resolve(root, name));
  files.push({ name, bytes });
}
assert(files.some((file) => file.name === 'pnpm-lock.yaml'));
assert(files.some((file) => file.name === 'packages/contracts/src/index.ts'));
assert(files.length < 65535);
await mkdir('.release', { recursive: true });
const source = zip(files);
await writeFile('.release/repository-source.zip', source);
const artifacts = [];
for (const name of (await readdir('apps/extension/.output'))
  .filter((name) => name.endsWith('.zip') && !name.includes('sources'))
  .sort()) {
  const bytes = await readFile(`apps/extension/.output/${name}`);
  await writeFile(`.release/${name}`, bytes);
  artifacts.push({ file: name, sha256: sha256(bytes), bytes: bytes.length });
}
assert.equal(
  artifacts.length,
  2,
  'Build both browser ZIPs before release preparation',
);
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
const dirty =
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    encoding: 'utf8',
  }).trim().length > 0;
const inventory = {
  schemaVersion: 1,
  status: 'development-only-not-approved-for-release',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  dirtyWorkingTree: dirty,
  node: process.version,
  artifacts,
  sourceFiles: files.map((file) => ({
    file: file.name,
    sha256: sha256(file.bytes),
  })),
};
await writeFile(
  '.release/inventory.json',
  JSON.stringify(inventory, null, 2) + '\n',
);
console.log(
  `Prepared complete monorepo source, two development browser packages, website ZIP, and SHA-256 inventory in .release/. Dirty source: ${dirty}. No release approval implied.`,
);
