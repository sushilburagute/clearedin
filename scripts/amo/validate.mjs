import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inventory = JSON.parse(await readFile('.release/inventory.json', 'utf8'));
const targets = inventory.artifacts.filter(({ file }) =>
  file.endsWith('-firefox.zip'),
);
assert.equal(targets.length, 1);
const [{ file, sha256 }] = targets;
assert.match(file, /^[a-zA-Z0-9._-]+$/);
const archive = resolve('.release', file);
assert.equal(
  createHash('sha256')
    .update(await readFile(archive))
    .digest('hex'),
  sha256,
);
const moduleDir = resolve('scripts/amo/node_modules/addons-linter');
const { version, bin } = JSON.parse(
  await readFile(resolve(moduleDir, 'package.json'), 'utf8'),
);
const result = spawnSync(
  process.execPath,
  [resolve(moduleDir, bin['addons-linter']), '--output', 'json', archive],
  { encoding: 'utf8' },
);
if (result.error) throw result.error;
if (result.stderr) process.stderr.write(result.stderr);
const report = JSON.parse(result.stdout);
await writeFile(
  '.release/amo-validation.json',
  JSON.stringify(
    { validator: `addons-linter@${version}`, file, sha256, report },
    null,
    2,
  ) + '\n',
);
console.log(report.summary);
for (const finding of [...report.errors, ...report.warnings]) {
  console.log(`${finding.file} ${finding.code}: ${finding.message}`);
}
assert.equal(result.status, 0, 'Mozilla validator exited unsuccessfully');
assert.equal(report.summary.errors, 0);

// Keep known upstream findings visible in the report; require review if their
// number increases, a finding moves to a different bundle, or a new one appears.
const reviewed = new Map([
  ['manifest.json KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION', 1],
  ['background.js DANGEROUS_EVAL', 1],
  ['chunks/bootstrap.js DANGEROUS_EVAL', 1],
  ['chunks/bootstrap.js UNSAFE_VAR_ASSIGNMENT', 2],
]);
for (const { file, code } of report.warnings) {
  const bundle = file.replace(
    /^chunks\/bootstrap-[\w-]+\.js$/,
    'chunks/bootstrap.js',
  );
  const key = `${bundle} ${code}`;
  assert(reviewed.get(key) > 0, `Review new Mozilla warning: ${file} ${code}`);
  reviewed.set(key, reviewed.get(key) - 1);
}
