import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { zipEntries } from './release-zip.mjs';

const inventory = JSON.parse(await readFile('.release/inventory.json', 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const expected = new Map(
  inventory.artifacts.map((entry) => [entry.file, entry.sha256]),
);
const source = await readFile('.release/repository-source.zip');
assert.equal(
  hash(source),
  expected.get('repository-source.zip'),
  'Source ZIP hash',
);
const directory = await mkdtemp(join(tmpdir(), 'clearedin-rebuild-'));
try {
  const entries = zipEntries(source);
  for (const [name, bytes] of entries) {
    const path = join(directory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { flag: 'wx' });
  }
  const node = entries.get('.node-version').toString().trim();
  const { packageManager } = JSON.parse(entries.get('package.json'));
  assert.equal(process.versions.node, node, 'Use the archived Node version');
  const cwd = directory;
  const pnpm = execSync('pnpm --version', { cwd, encoding: 'utf8' }).trim();
  assert.equal(`pnpm@${pnpm}`, packageManager);
  execSync('pnpm install --frozen-lockfile', { cwd, stdio: 'inherit' });
  const browsers = [];
  for (const browser of ['chrome', 'firefox']) {
    execSync(`pnpm package:${browser}`, { cwd, stdio: 'inherit' });
    const candidates = [...expected.keys()].filter((name) =>
      name.endsWith(`-${browser}.zip`),
    );
    assert.equal(candidates.length, 1);
    const [file] = candidates;
    assert.match(file, /^[a-zA-Z0-9._-]+$/);
    const delivered = await readFile(join('.release', file));
    assert.equal(
      hash(delivered),
      expected.get(file),
      `Inventory hash for ${file}`,
    );
    const rebuilt = await readFile(join(cwd, 'apps/extension/.output', file));
    assert.equal(
      hash(rebuilt),
      hash(delivered),
      `Rebuilt ZIP differs: ${file}`,
    );
    browsers.push({ file, sha256: hash(rebuilt) });
  }
  await writeFile(
    '.release/rebuild.json',
    JSON.stringify(
      {
        sourceCommit: inventory.sourceCommit,
        sourceSha256: hash(source),
        node,
        pnpm,
        platform: process.platform,
        browsers,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Both browser ZIPs reproduced byte for byte from the archived monorepo.',
  );
} finally {
  await rm(directory, { recursive: true, force: true, maxRetries: 3 });
}
