import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory()
        ? markdownFiles(path)
        : entry.name.endsWith('.md')
          ? [path]
          : [];
    }),
  );
  return files.flat();
}

const files = [resolve('README.md'), ...(await markdownFiles(resolve('docs')))];
const errors = [];
for (const file of files) {
  const content = await readFile(file, 'utf8');
  const fences = content.match(/^```/gm) ?? [];
  if (fences.length % 2) errors.push(`${file}: unclosed code fence`);
  // Code examples are not links in the rendered documentation.
  const prose = content.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  for (const match of prose.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    try {
      await stat(resolve(dirname(file), decodeURIComponent(target)));
    } catch {
      errors.push(`${file}: missing local target ${target}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Checked local links and code fences in ${files.length} Markdown files. External URLs were not fetched.`,
  );
