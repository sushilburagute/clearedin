import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
async function walk(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(path)));
    else result.push(path);
  }
  return result;
}
const packages = (await walk(resolve('apps/extension/.output'))).filter((p) =>
  p.endsWith('.zip'),
);
if (
  !packages.some((p) => p.includes('chrome')) ||
  !packages.some((p) => p.includes('firefox'))
)
  throw new Error('Both browser packages required');
const website = await walk(resolve('apps/website/dist'));
if (!website.some((p) => p.endsWith('index.html')))
  throw new Error('Website build required');
const inventory = {
  commit: git('rev-parse', 'HEAD'),
  dirty: Boolean(git('status', '--porcelain')),
  node: process.version,
  approval: 'pending',
  artifacts: [],
};
for (const path of [...packages, ...website].sort()) {
  const bytes = await readFile(path);
  inventory.artifacts.push({
    path: relative(process.cwd(), path).replaceAll('\\', '/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await mkdir('artifacts', { recursive: true });
await writeFile(
  'artifacts/release-inventory.json',
  JSON.stringify(inventory, null, 2) + '\n',
);
console.log(
  `Inventoried ${inventory.artifacts.length} files; source ${inventory.commit}; dirty=${inventory.dirty}; approval pending.`,
);
