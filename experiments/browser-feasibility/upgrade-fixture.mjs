import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { zip, zipEntries } from '../../scripts/release-zip.mjs';

// Create an unsigned, manifest-version-only update inside the disposable profile.
// Chrome needs the same unpacked path for both installations to retain its ID.
export async function prepareUpgrade(directory, archive, family) {
  const bytes = await readFile(archive);
  const entries = zipEntries(bytes);
  const manifest = JSON.parse(entries.get('manifest.json'));
  const from = manifest.version;
  const parts = from.split('.').map(Number);
  assert(
    parts.at(-1) < 65535,
    'Fixture needs an incrementable final version component',
  );
  parts[parts.length - 1]++;
  const to = parts.join('.');
  const unpacked = join(directory, 'unpacked');
  if (family === 'chrome') {
    for (const [name, content] of entries) {
      const file = join(unpacked, name);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content, { flag: 'wx' });
    }
  }
  return {
    unpacked,
    evidence: {
      from,
      to,
      sourceZipSha256: createHash('sha256').update(bytes).digest('hex'),
    },
    async update() {
      const content = Buffer.from(JSON.stringify({ ...manifest, version: to }));
      if (family === 'chrome') {
        await writeFile(join(unpacked, 'manifest.json'), content);
        return unpacked;
      }
      entries.set('manifest.json', content);
      const target = join(directory, 'recovery.zip');
      await writeFile(
        target,
        zip([...entries].map(([name, bytes]) => ({ name, bytes }))),
      );
      return target;
    },
  };
}
