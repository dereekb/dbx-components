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
 * Those two halves have different scopes, which is what `--mode` selects:
 *
 *   - `--mode=rewrite <dir>` rewrites `<dir>/package.json` and nothing else. It is per-package and
 *     idempotent. NOTE it is currently UNUSED, and switching the per-package callers to it would be
 *     a regression: it would stop rewriting the nested subpath `package.json` files. Those are their
 *     own packages, but they have no `build` of their own — under the build-graph design a subpath
 *     entry point is a compilation unit, not a deliverable, so its parent's `build` is the only
 *     thing that finalizes it. This mode only becomes usable if children ever gain their own
 *     `build`, which is exactly the design that was tried and reverted.
 *   - `--mode=verify <dirs...>` runs the assertions over the whole tree and writes nothing. The
 *     assertions are only valid once *everything* has been built: a parent package's `exports`
 *     names its subpaths, so verifying it the moment the parent finishes — before its subpaths
 *     build — reports targets that simply do not exist yet. Hence `workspace:verify-esm-exports`,
 *     which `workspace:build-all` runs once after the whole `run-many -t build` sweep.
 *   - no flag runs both over the whole tree. This is the original single-shot behavior and what all
 *     19 per-package `build` targets use: the parent's `build` runs after every one of its entry
 *     points, so by then the whole package directory is complete and both halves are valid on it.
 *
 * Usage: node tools/scripts/finalize-esm-exports.mjs [--mode=rewrite|verify] <distPackageDir> [...moreDirs]
 *   e.g. node tools/scripts/finalize-esm-exports.mjs --mode=rewrite dist/packages/util
 *        node tools/scripts/finalize-esm-exports.mjs --mode=verify dist/packages
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

/** `both` is the no-flag default, preserving the original single-shot behavior. */
const MODES = ['rewrite', 'verify', 'both'];

const roots = [];
let mode = 'both';

for (const arg of process.argv.slice(2)) {
  const flag = /^--mode=(.*)$/.exec(arg);

  if (flag) {
    mode = flag[1];
  } else {
    roots.push(arg);
  }
}

if (!MODES.includes(mode)) {
  console.error(`finalize-esm-exports: unknown --mode=${mode}; expected one of ${MODES.join(', ')}.`);
  process.exit(1);
}

if (!roots.length) {
  console.error('finalize-esm-exports: expected at least one dist package directory.');
  process.exit(1);
}

const rewriting = mode === 'rewrite' || mode === 'both';
const verifying = mode === 'verify' || mode === 'both';

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

  // A rewrite-only pass deliberately owns exactly one package.json — its own. Nothing calls it that
  // way today (see the --mode notes above): subpath packages have no `build` to finalize them, so
  // the parent's whole-tree `both` pass is what covers them.
  const packageJsonPaths = verifying ? collectPackageJsonPaths(root) : [join(root, 'package.json')];

  for (const packageJsonPath of packageJsonPaths) {
    if (!existsSync(packageJsonPath)) {
      violations.push(`${packageJsonPath}: package.json does not exist — was the build run?`);
      continue;
    }

    inspected++;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    let changed = false;

    if (rewriting) {
      for (const [key, value] of Object.entries(packageJson.exports ?? {})) {
        const normalized = normalizeExportEntry(value);

        if (normalized.changed) {
          packageJson.exports[key] = normalized.entry;
          changed = true;
        }
      }
    }

    if (changed) {
      writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
      rewritten++;
    }

    if (!verifying) {
      continue;
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

  if (!verifying) {
    continue;
  }

  const scopes = new Map(packageJsonPaths.map((path) => [dirname(path), path]));

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

console.log(`finalize-esm-exports[${mode}]: ${inspected} package.json inspected, ${rewritten} rewritten (${roots.join(', ')}).`);

if (!violations.length) {
  process.exit(0);
}

console.error(`\n${violations.length} ESM packaging violation(s):\n`);

for (const violation of violations) {
  console.error(`  ${violation}`);
}

console.error('');
process.exit(1);
