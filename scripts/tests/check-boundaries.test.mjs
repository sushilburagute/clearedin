import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkBoundaries } from '../check-boundaries.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clearedin-boundaries-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (relative, content) => {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(
      full,
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  };
  const unit = (name, kind = 'packages', extra = {}) => {
    write(`${kind}/${name}/package.json`, {
      name: `@clearedin/${name}`,
      exports: { '.': './src/index.ts' },
      ...extra,
    });
    write(`${kind}/${name}/src/index.ts`, 'export const example = 1;');
  };
  unit('contracts');
  unit('taxonomy', 'packages', {
    dependencies: { '@clearedin/contracts': 'workspace:*' },
  });
  unit('providers');
  unit('storage');
  unit('ui');
  unit('test-fixtures');
  unit('website', 'apps');
  unit('extension', 'apps');
  return { root, write, unit, check: () => checkBoundaries(root) };
}

test('permits the declared safe graph and app extension provider access', (t) => {
  const f = fixture(t);
  f.write(
    'apps/website/src/index.ts',
    "export { example } from '@clearedin/ui';",
  );
  f.write(
    'packages/ui/src/index.ts',
    "import { example } from '@clearedin/contracts'; export { example };",
  );
  f.write('apps/extension/src/index.ts', "import('@clearedin/providers');");
  assert.deepEqual(f.check(), []);
});

test('rejects privileged website/UI imports including type-only imports', (t) => {
  const f = fixture(t);
  f.write(
    'apps/website/src/index.ts',
    "import type { Secret } from '@clearedin/storage';",
  );
  f.write('packages/ui/src/index.ts', "export * from '@clearedin/providers';");
  const issues = f.check().join('\n');
  assert.match(issues, /website must not depend on storage/);
  assert.match(issues, /ui must not depend on providers/);
});

test('rejects a privileged transitive barrel', (t) => {
  const f = fixture(t);
  f.write(
    'apps/website/src/index.ts',
    "import { example } from '@clearedin/test-fixtures';",
  );
  f.write(
    'packages/test-fixtures/src/index.ts',
    "export * from '@clearedin/providers';",
  );
  assert.match(
    f.check().join('\n'),
    /test-fixtures must not depend on providers/,
  );
});

test('rejects relative path escapes even when they are unresolved', (t) => {
  const f = fixture(t);
  f.write(
    'packages/ui/src/index.ts',
    "export * from '../../storage/src/index'; export * from '../../providers/src/missing';",
  );
  const issues = f.check().join('\n');
  assert.match(issues, /ui must not depend on storage/);
  assert.match(issues, /ui must not depend on providers/);
  assert.match(issues, /unresolved internal import/);
});

test('checks inherited tsconfig aliases and all fallback destinations', (t) => {
  const f = fixture(t);
  f.write('tsconfig.base.json', {
    compilerOptions: {
      baseUrl: '.',
      paths: {
        '@secret/*': ['packages/storage/src/*'],
        '@fallback': [
          'packages/contracts/src/index.ts',
          'packages/providers/src/index.ts',
        ],
      },
    },
  });
  f.write('apps/website/tsconfig.json', {
    extends: '../../tsconfig.base.json',
  });
  f.write(
    'apps/website/src/index.ts',
    "import '@secret/index'; import '@fallback';",
  );
  const issues = f.check().join('\n');
  assert.match(issues, /website must not depend on storage/);
  assert.match(issues, /website must not depend on providers/);
});

test('checks dependency declarations and forbids package-to-app edges', (t) => {
  const f = fixture(t);
  f.unit('ui', 'packages', {
    dependencies: { '@clearedin/storage': 'workspace:*' },
  });
  f.write(
    'packages/contracts/src/index.ts',
    "export * from '../../../apps/website/src/index';",
  );
  const issues = f.check().join('\n');
  assert.match(issues, /ui must not declare dependency on storage/);
  assert.match(issues, /contracts must not depend on website/);
});

test('checks dynamic imports, require, import types, and computed modules', (t) => {
  const f = fixture(t);
  f.write(
    'apps/website/src/index.ts',
    "const x = require('@clearedin/storage'); import('@clearedin/providers'); type T = import('@clearedin/providers').T; import(moduleName);",
  );
  const issues = f.check().join('\n');
  assert.match(issues, /website must not depend on storage/);
  assert.match(issues, /website must not depend on providers/);
  assert.match(issues, /computed import\/require/);
});

test('checks Astro frontmatter and script imports', (t) => {
  const f = fixture(t);
  f.write(
    'apps/website/src/page.astro',
    "---\nimport '@clearedin/storage';\n---\n<h1>Example</h1><script>import('@clearedin/providers');</script>",
  );
  const issues = f.check().join('\n');
  assert.match(issues, /website must not depend on storage/);
  assert.match(issues, /website must not depend on providers/);
});

test('rejects unknown workspace imports and unexported subpaths', (t) => {
  const f = fixture(t);
  f.write(
    'apps/website/src/index.ts',
    "import '@clearedin/missing'; import '@clearedin/contracts/private';",
  );
  const issues = f.check().join('\n');
  assert.match(issues, /unresolved internal import @clearedin\/missing/);
  assert.match(
    issues,
    /unresolved or unexported workspace import @clearedin\/contracts\/private/,
  );
});

test('supports explicit and patterned workspace exports', (t) => {
  const f = fixture(t);
  f.unit('contracts', 'packages', {
    exports: {
      '.': { types: './src/index.ts', import: './src/index.ts' },
      './models/*': './src/models/*.ts',
    },
  });
  f.write(
    'packages/contracts/src/models/post.ts',
    'export type Post = string;',
  );
  f.write(
    'apps/website/src/index.ts',
    "import '@clearedin/contracts'; import '@clearedin/contracts/models/post';",
  );
  assert.deepEqual(f.check(), []);
});

test('ignores generated output and third-party code', (t) => {
  const f = fixture(t);
  f.write('apps/website/dist/unsafe.js', "import '@clearedin/providers';");
  f.write('packages/ui/node_modules/example/index.js', 'import(variable);');
  assert.deepEqual(f.check(), []);
});

test('rejects local manifest aliases and unregistered boundaries', (t) => {
  const f = fixture(t);
  f.unit('ui', 'packages', { dependencies: { hidden: 'file:../storage' } });
  f.unit('unreviewed');
  const issues = f.check().join('\n');
  assert.match(issues, /local dependency alias hidden/);
  assert.match(issues, /unregistered workspace boundary unreviewed/);
});
