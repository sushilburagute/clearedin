import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// An allowlist also constrains transitive imports: no allowed intermediary can
// re-export a privileged package without failing its own boundary check.
export const ALLOWED_DEPENDENCIES = Object.freeze({
  contracts: [],
  taxonomy: ['contracts'],
  providers: ['contracts', 'taxonomy'],
  'decision-engine': ['contracts', 'taxonomy'],
  'linkedin-adapter': ['contracts', 'taxonomy', 'ui', 'test-fixtures'],
  storage: ['contracts'],
  ui: ['contracts', 'taxonomy', 'decision-engine'],
  'test-fixtures': ['contracts', 'taxonomy'],
  website: ['contracts', 'taxonomy', 'decision-engine', 'ui', 'test-fixtures'],
  extension: [
    'contracts',
    'taxonomy',
    'providers',
    'decision-engine',
    'linkedin-adapter',
    'storage',
    'ui',
    'test-fixtures',
  ],
});

const IGNORED = new Set([
  'node_modules',
  '.git',
  '.wxt',
  '.astro',
  '.output',
  'dist',
  'coverage',
  '.cache',
  'generated',
]);
const SOURCE = /\.(?:[cm]?[jt]sx?|astro)$/;
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.astro',
  '.json',
];

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (IGNORED.has(entry.name) || entry.isSymbolicLink()) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function real(file) {
  return fs.existsSync(file) ? fs.realpathSync(file) : path.resolve(file);
}

function resolveFile(candidate) {
  for (const item of [
    candidate,
    ...SOURCE_EXTENSIONS.map((ext) => candidate + ext),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(candidate, `index${ext}`)),
  ]) {
    if (fs.existsSync(item) && fs.statSync(item).isFile()) return real(item);
  }
  return undefined;
}

function exportTarget(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(exportTarget).find(Boolean);
  if (value && typeof value === 'object') {
    for (const condition of ['types', 'import', 'default', 'require']) {
      const target = exportTarget(value[condition]);
      if (target) return target;
    }
  }
  return undefined;
}

function workspaceTarget(unit, specifier) {
  const suffix = specifier.slice(unit.manifest.name.length);
  const key = suffix ? `.${suffix}` : '.';
  const exports = unit.manifest.exports;
  let target;
  if (
    typeof exports === 'string' ||
    (exports && !Object.keys(exports).some((item) => item.startsWith('.')))
  ) {
    if (key === '.') target = exportTarget(exports);
  } else if (exports && Object.hasOwn(exports, key)) {
    target = exportTarget(exports[key]);
  } else if (exports) {
    for (const pattern of Object.keys(exports)) {
      const star = pattern.indexOf('*');
      if (star < 0) continue;
      const prefix = pattern.slice(0, star);
      const tail = pattern.slice(star + 1);
      if (key.startsWith(prefix) && key.endsWith(tail)) {
        const captured = key.slice(
          prefix.length,
          tail ? -tail.length : undefined,
        );
        target = exportTarget(exports[pattern])?.replaceAll('*', captured);
        break;
      }
    }
  } else if (key === '.') {
    target =
      unit.manifest.types ??
      unit.manifest.module ??
      unit.manifest.main ??
      './src/index.ts';
  }
  if (!target?.startsWith('./')) return undefined;
  const resolved = resolveFile(path.resolve(unit.directory, target));
  return resolved && inside(unit.directory, resolved) ? resolved : undefined;
}

function compilerOptions(file, root) {
  const config = ts.findConfigFile(path.dirname(file), ts.sys.fileExists);
  if (!config || !inside(root, config))
    return { moduleResolution: ts.ModuleResolutionKind.Bundler };
  const parsed = ts.readConfigFile(config, ts.sys.readFile);
  if (parsed.error)
    return { moduleResolution: ts.ModuleResolutionKind.Bundler };
  return {
    ...ts.parseJsonConfigFileContent(
      parsed.config,
      ts.sys,
      path.dirname(config),
    ).options,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
}

function aliasCandidates(specifier, options, file) {
  const candidates = [];
  for (const [pattern, targets] of Object.entries(options.paths ?? {})) {
    const star = pattern.indexOf('*');
    let capture;
    if (star < 0) {
      if (pattern !== specifier) continue;
      capture = '';
    } else {
      const prefix = pattern.slice(0, star);
      const suffix = pattern.slice(star + 1);
      if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix))
        continue;
      capture = specifier.slice(
        prefix.length,
        suffix ? -suffix.length : undefined,
      );
    }
    const base = options.baseUrl ?? options.pathsBasePath ?? path.dirname(file);
    for (const target of targets)
      candidates.push(path.resolve(base, target.replaceAll('*', capture)));
  }
  return candidates;
}

function sourceSections(file, content) {
  if (!file.endsWith('.astro')) return [content];
  const sections = [];
  const frontmatter = /^(?:\uFEFF)?---\s*\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (frontmatter) sections.push(frontmatter[1]);
  for (const script of content.matchAll(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  ))
    sections.push(script[1]);
  return sections;
}

function importReferences(file) {
  const references = [];
  for (const content of sourceSections(file, fs.readFileSync(file, 'utf8'))) {
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const add = (expression) => {
      references.push(
        expression && ts.isStringLiteralLike(expression)
          ? expression.text
          : null,
      );
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (node.moduleSpecifier) add(node.moduleSpecifier);
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference)
      ) {
        add(node.moduleReference.expression);
      } else if (ts.isImportTypeNode(node)) {
        add(
          ts.isLiteralTypeNode(node.argument)
            ? node.argument.literal
            : undefined,
        );
      } else if (ts.isCallExpression(node)) {
        if (
          node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === 'require')
        )
          add(node.arguments[0]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return references;
}

/** Return violations without mutating the workspace. Third-party dependency
 * behavior is outside this source-level guard; review those dependencies too. */
export function checkBoundaries(rootDirectory) {
  const root = real(rootDirectory);
  const issues = [];
  const units = [];
  const report = (file, message) =>
    issues.push(
      `${path.relative(root, file).replaceAll(path.sep, '/')}: ${message}`,
    );
  for (const kind of ['packages', 'apps']) {
    const parent = path.join(root, kind);
    if (!fs.existsSync(parent)) continue;
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const directory = real(path.join(parent, entry.name));
      const manifestFile = path.join(directory, 'package.json');
      if (!fs.existsSync(manifestFile)) {
        report(
          manifestFile,
          'workspace directory must have a package manifest',
        );
        continue;
      }
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      if (!Object.hasOwn(ALLOWED_DEPENDENCIES, entry.name))
        report(manifestFile, `unregistered workspace boundary ${entry.name}`);
      units.push({ id: entry.name, directory, manifestFile, manifest, kind });
    }
  }
  const ownerOf = (file) => units.find((unit) => inside(unit.directory, file));
  const allowed = (from, to) =>
    from === to ||
    (to.kind === 'packages' &&
      (ALLOWED_DEPENDENCIES[from.id] ?? []).includes(to.id));
  const checkTarget = (unit, file, target, specifier) => {
    const owner = ownerOf(real(target));
    if (!owner) {
      report(
        file,
        `internal import ${specifier} escapes registered workspace boundaries`,
      );
    } else if (!allowed(unit, owner)) {
      report(file, `${unit.id} must not depend on ${owner.id} (${specifier})`);
    }
  };
  for (const unit of units) {
    const dependencies = {
      ...unit.manifest.dependencies,
      ...unit.manifest.devDependencies,
      ...unit.manifest.peerDependencies,
      ...unit.manifest.optionalDependencies,
    };
    for (const [name, version] of Object.entries(dependencies)) {
      const target = units.find(
        (candidate) => candidate.manifest.name === name,
      );
      if (target && !allowed(unit, target))
        report(
          unit.manifestFile,
          `${unit.id} must not declare dependency on ${target.id}`,
        );
      if (
        !target &&
        (name.startsWith('@clearedin/') ||
          String(version).startsWith('workspace:'))
      )
        report(unit.manifestFile, `unknown workspace dependency ${name}`);
      if (/^(?:file:|link:)/.test(String(version)))
        report(
          unit.manifestFile,
          `local dependency alias ${name} must use a registered workspace package`,
        );
      if (String(version).startsWith('npm:@clearedin/'))
        report(
          unit.manifestFile,
          `workspace npm alias ${name} is not permitted`,
        );
    }
    for (const file of filesUnder(unit.directory).filter((item) =>
      SOURCE.test(item),
    )) {
      const options = compilerOptions(file, root);
      for (const specifier of importReferences(file)) {
        if (specifier === null) {
          report(
            file,
            'computed import/require cannot be boundary-checked; use a literal module specifier',
          );
          continue;
        }
        const targetUnit = units.find(
          (candidate) =>
            specifier === candidate.manifest.name ||
            specifier.startsWith(`${candidate.manifest.name}/`),
        );
        if (targetUnit) {
          if (!allowed(unit, targetUnit))
            report(
              file,
              `${unit.id} must not depend on ${targetUnit.id} (${specifier})`,
            );
          if (!workspaceTarget(targetUnit, specifier))
            report(
              file,
              `unresolved or unexported workspace import ${specifier}`,
            );
          continue;
        }
        const aliases = aliasCandidates(specifier, options, file);
        if (aliases.length) {
          const resolved = aliases.map(resolveFile).find(Boolean);
          if (!resolved) report(file, `unresolved internal alias ${specifier}`);
          for (const candidate of aliases)
            checkTarget(unit, file, candidate, specifier);
          if (resolved) checkTarget(unit, file, resolved, specifier);
          continue;
        }
        if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
          const lexical = path.resolve(path.dirname(file), specifier);
          checkTarget(unit, file, lexical, specifier);
          const resolved =
            ts.resolveModuleName(specifier, file, options, ts.sys)
              .resolvedModule?.resolvedFileName ?? resolveFile(lexical);
          if (resolved) checkTarget(unit, file, real(resolved), specifier);
          else if (
            !/\.(?:css|svg|png|jpg|jpeg|webp|ico)$/.test(specifier) ||
            !fs.existsSync(lexical)
          )
            report(file, `unresolved internal import ${specifier}`);
          continue;
        }
        const resolved = ts.resolveModuleName(specifier, file, options, ts.sys)
          .resolvedModule?.resolvedFileName;
        if (
          resolved &&
          inside(root, real(resolved)) &&
          !real(resolved).includes(`${path.sep}node_modules${path.sep}`)
        )
          checkTarget(unit, file, real(resolved), specifier);
        else if (
          specifier.startsWith('@clearedin/') ||
          specifier.startsWith('#')
        )
          report(file, `unresolved internal import ${specifier}`);
      }
    }
  }
  return [...new Set(issues)].sort();
}

if (
  process.argv[1] &&
  real(process.argv[1]) === real(fileURLToPath(import.meta.url))
) {
  const issues = checkBoundaries(process.argv[2] ?? process.cwd());
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Workspace dependency boundaries passed.');
  }
}
