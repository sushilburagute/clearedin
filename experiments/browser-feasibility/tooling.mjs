import { existsSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Reuse task 01's installed, locked WXT toolchain without adding a workspace,
// changing the lockfile, or building the production extension entrypoints.
const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../..');
const extensionModules = resolve(repository, 'apps/extension/node_modules');
if (!existsSync(extensionModules)) throw new Error('Run pnpm install first.');
if (!existsSync(resolve(directory, 'node_modules'))) {
  symlinkSync(extensionModules, resolve(directory, 'node_modules'), 'junction');
}
const wxt = resolve(extensionModules, 'wxt/bin/wxt.mjs');
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: directory,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const command = process.argv[2];
if (command === 'build' || command === 'zip') {
  for (const browser of ['chrome', 'firefox']) {
    run(wxt, [command, '-b', browser, '--mv3']);
  }
} else if (command === 'check') {
  run(wxt, ['prepare']);
  run(resolve(repository, 'node_modules/typescript/bin/tsc'), ['--noEmit']);
} else if (command === 'test') {
  run(resolve(repository, 'node_modules/vitest/vitest.mjs'), [
    'run',
    '--config',
    'vitest.config.ts',
  ]);
} else {
  throw new Error('Usage: node tooling.mjs build|zip|check|test');
}
