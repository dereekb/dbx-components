/**
 * Normalizes and then verifies the ESM-only shape of a built `@dereekb/*` package.
 *
 * `@nx/rollup` emits `exports['.'] = { import: './index.esm.js', types: './index.d.ts' }` for a
 * `"type": "module"` package, and it HARD-OVERWRITES that key — it cannot be pre-seeded from the
 * source `package.json`. Two things are wrong with what it writes:
 *
 *   1. `types` comes AFTER `import`. Conditions are matched in declaration order, so TypeScript
 *      resolves `import` first and never sees the `types` entry.
 *   2. There is no `default` condition, so a CommonJS `require()` fails with
 *      `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than going through Node's `require(ESM)` support.
 *      `arktype` — an ESM-only dependency these packages already carry — keeps a `default` for
 *      exactly this reason.
 *
 * So this script rewrites each entry to `{ types, import, default }`, all pointing at the real
 * ESM build, and then asserts the invariants that make the package loadable:
 *
 *   - no CommonJS build artifacts survive anywhere in the tree;
 *   - every directory holding ambiguous `.js` files sits in a package scope declaring
 *     `"type": "module"`, so Node's parse goal is explicit rather than left to syntax detection;
 *   - every path an `exports` entry points at actually exists on disk.
 *
 * It walks the whole dist tree because subpath entry points are their own nested packages with
 * their own `package.json`, and those have only a `build-base` target — there is no per-subpath
 * `build` to hook individually.
 *
 * Usage: node tools/scripts/finalize-esm-exports.mjs <distPackageDir> [...moreDirs]
 *   e.g. node tools/scripts/finalize-esm-exports.mjs dist/packages/util
 *
 * Exits non-zero and lists every violation. Companion check:
 * `tools/scripts/check-esm-named-imports.mjs` (`nx run workspace:check-esm-imports`), which
 * verifies the bundles' third-party named imports can bind under plain Node.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

/** Build outputs that must not survive the ESM-only switch. */
const CJS_ARTIFACT = /\.cjs\.js$|\.cjs\.mjs$|\.cjs\.default\.js$/;

/** The condition order every rewritten entry gets. `types` must lead — conditions match in order. */
const CONDITION_ORDER = ['types', 'import', 'default'];

const roots = process.argv.slice(2);

if (!roots.length) {
  console.error('finalize-esm-exports: expected at least one dist package directory.');
  process.exit(1);
}

/** Collect every package.json under `dir`, nested subpath packages included. */
function collectPackageJsonPaths(dir) {
  const found = [];

  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') {
      continue;
    }

    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      found.push(...collectPackageJsonPaths(path));
    } else if (entry === 'package.json') {
      found.push(path);
    }
  }

  return found;
}

/** Collect every file under `dir`, as workspace-relative paths. */
function collectFiles(dir) {
  const found = [];

  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') {
      continue;
    }

    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      found.push(...collectFiles(path));
    } else {
      found.push(path);
    }
  }

  return found;
}

/**
 * Rewrite one exports entry to `{ types, import, default }` when it names an ESM build but no
 * `default`. Anything else — ng-packagr's `{ types, default }`, the `sass` entry, plain string
 * targets — is already unambiguous and is left alone.
 */
function normalizeExportEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { entry, changed: false };
  }

  if (!entry.import || entry.default) {
    return { entry, changed: false };
  }

  const normalized = {};

  // `module` is the bundler-only condition the dual build needed; with a single ESM output it is
  // redundant, and leaving it would keep bundlers on a separate resolution path from Node.
  const { module: _module, ...rest } = { ...entry, default: entry.import };

  for (const condition of CONDITION_ORDER) {
    if (rest[condition]) {
      normalized[condition] = rest[condition];
    }
  }

  for (const [condition, value] of Object.entries(rest)) {
    if (!CONDITION_ORDER.includes(condition)) {
      normalized[condition] = value;
    }
  }

  return { entry: normalized, changed: true };
}

/** Every on-disk path an exports map points at, as `[exportKey, target]` pairs. */
function exportTargets(exports) {
  const targets = [];

  if (!exports || typeof exports !== 'object') {
    return targets;
  }

  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === 'string') {
      targets.push([key, value]);
    } else if (value && typeof value === 'object') {
      for (const target of Object.values(value)) {
        if (typeof target === 'string') {
          targets.push([key, target]);
        }
      }
    }
  }

  return targets;
}

const violations = [];
let rewritten = 0;
let inspected = 0;

for (const root of roots) {
  if (!existsSync(root)) {
    violations.push(`${root}: dist directory does not exist — was the build run?`);
    continue;
  }

  const packageJsonPaths = collectPackageJsonPaths(root);
  const scopes = new Map(packageJsonPaths.map((path) => [dirname(path), path]));

  for (const packageJsonPath of packageJsonPaths) {
    inspected++;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let changed = false;

    for (const [key, value] of Object.entries(packageJson.exports ?? {})) {
      const normalized = normalizeExportEntry(value);

      if (normalized.changed) {
        packageJson.exports[key] = normalized.entry;
        changed = true;
      }
    }

    if (changed) {
      writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
      rewritten++;
    }

    for (const [key, target] of exportTargets(packageJson.exports)) {
      if (!target.startsWith('./')) {
        continue;
      }

      if (!existsSync(join(dirname(packageJsonPath), target))) {
        violations.push(`${packageJsonPath}: exports["${key}"] points at ${target}, which was not built.`);
      }
    }
  }

  /** The nearest package scope for a file, mirroring Node's LOOKUP_PACKAGE_SCOPE. */
  function scopeFor(dir) {
    let current = dir;

    while (current.startsWith(root)) {
      if (scopes.has(current)) {
        return scopes.get(current);
      }

      current = dirname(current);
    }

    return undefined;
  }

  const ambiguous = new Map();

  for (const file of collectFiles(root)) {
    if (CJS_ARTIFACT.test(file)) {
      violations.push(`${file}: CommonJS build artifact — the package should build ESM only.`);
      continue;
    }

    if (!file.endsWith('.js')) {
      continue;
    }

    const scope = scopeFor(dirname(file));

    if (!scope) {
      violations.push(`${file}: no package.json scope — Node would parse it as CommonJS.`);
      continue;
    }

    if (!ambiguous.has(scope)) {
      ambiguous.set(scope, file);
    }
  }

  for (const [scope, example] of ambiguous) {
    const packageJson = JSON.parse(readFileSync(scope, 'utf8'));

    if (packageJson.type !== 'module') {
      violations.push(`${scope}: missing "type": "module", so Node parses ${relative(dirname(scope), example)} as CommonJS.`);
    }
  }
}

console.log(`finalize-esm-exports: ${inspected} package.json inspected, ${rewritten} rewritten (${roots.join(', ')}).`);

if (!violations.length) {
  process.exit(0);
}

console.error(`\n${violations.length} ESM packaging violation(s):\n`);

for (const violation of violations) {
  console.error(`  ${violation}`);
}

console.error('');
process.exit(1);
