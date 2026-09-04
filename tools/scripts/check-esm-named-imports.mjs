/**
 * Fails the build when an ESM bundle named-imports a binding that Node cannot bind.
 *
 * Covers both the published package bundles under `dist/packages` and the esm-only app bundles
 * under `dist/apps`. The app bundles matter as much as the packages: a Firebase Functions bundle
 * is loaded by bare Node, so an unbindable named import is a load-time crash of the entire
 * deployed function rather than a single broken call site.
 *
 * A dependency without an `exports` map resolves through `main` to its CommonJS build, and
 * Node synthesizes that module's ESM namespace with `cjs-module-lexer`. Any name the lexer
 * fails to detect cannot be bound by a static named import, so the whole bundle dies at load
 * time with `SyntaxError: Named export 'X' not found`. Bundlers do their own, more forgiving
 * CJS interop, so this class of defect is invisible to every Angular/webpack consumer and only
 * surfaces in a plain-Node one — which is how `@dereekb/date` shipped an ESM build that could
 * not be loaded by Node at all (it named-imported `RRule` from `rrule`).
 *
 * The check is static plus namespace-based rather than "import each bundle and see": it never
 * executes the bundles, so it covers the Angular packages too instead of drowning in
 * `needs to be compiled using the JIT compiler` errors from importing Angular libraries
 * outside an Angular app.
 *
 * Usage: node tools/scripts/check-esm-named-imports.mjs [distDir...]
 *   distDirs default to `dist/packages` and `dist/apps`.
 *
 * Exits non-zero and lists every offending (bundle, specifier, name) triple.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const DIST_DIRS = process.argv.slice(2).length ? process.argv.slice(2) : ['dist/packages', 'dist/apps'];

/**
 * Specifiers deliberately not checked, each with the reason it is exempt.
 *
 * Keep this list short and justified. An entry here is a promise that no plain-Node consumer
 * can ever load the importing bundle.
 */
const EXEMPT = new Map([
  [
    'mapbox-gl',
    'Imported only by @dereekb/dbx-web/mapbox, an ng-packagr Angular package that can never load in bare Node regardless (its Angular peer dependencies cannot). mapbox-gl also declares a `default` whose type is a strict subset of its namespace, so the interop unwrap used elsewhere would be a type lie in TypeScript.'
  ]
]);

/**
 * The entry of an esm-only `@nx/esbuild` app bundle, or `undefined` when `dir` is not one.
 *
 * An app bundle is a single self-contained file rather than a published package, so it has
 * neither the rollup nor the ng-packagr filename. What identifies it is the generated
 * `package.json` that `@nx/js` writes for an esm-only build: `"type": "module"` plus a `main`
 * pointing at the emitted entry. The `type` is load-bearing here — the entry is named `.js`,
 * so without it Node parses the bundle as CommonJS and none of this applies.
 */
function esmAppEntry(dir) {
  const manifest = join(dir, 'package.json');
  let entry;

  if (existsSync(manifest)) {
    try {
      const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
      const main = typeof pkg.main === 'string' ? join(dir, pkg.main) : undefined;

      if (pkg.type === 'module' && main && existsSync(main) && statSync(main).isFile()) {
        entry = main;
      }
    } catch {
      entry = undefined; // an unreadable/!JSON package.json is not an app bundle.
    }
  }

  return entry;
}

/**
 * Collect every ESM bundle: rollup `index.esm.js`, ng-packagr `fesm2022/*.mjs`, plus the
 * esm-only app bundles under `dist/apps` (demo-api and any scaffolded API app), which are
 * exposed to exactly the same CJS-interop hazard once they stop being CommonJS.
 */
function collectBundles(dir, depth = 0) {
  const found = new Set();

  if (depth > 3 || !existsSync(dir)) {
    return [];
  }

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (!statSync(path).isDirectory() || entry === 'node_modules' || entry === 'src') {
      continue;
    }

    if (existsSync(join(path, 'index.esm.js'))) {
      found.add(join(path, 'index.esm.js'));
    }

    const appEntry = esmAppEntry(path);

    if (appEntry) {
      found.add(appEntry);
    }

    const fesm = join(path, 'fesm2022');

    if (existsSync(fesm)) {
      for (const file of readdirSync(fesm)) {
        if (file.endsWith('.mjs')) {
          found.add(join(fesm, file));
        }
      }
    }

    for (const nested of collectBundles(path, depth + 1)) {
      found.add(nested);
    }
  }

  return [...found];
}

const NAMED_IMPORT = /^import\s+(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm;

/** specifier -> { names: Set<string>, bundles: Set<string> } */
function collectNamedImports(bundles) {
  const bySpecifier = new Map();

  for (const bundle of bundles) {
    for (const match of readFileSync(bundle, 'utf8').matchAll(NAMED_IMPORT)) {
      const specifier = match[2];

      // Relative and node: specifiers are never CJS-interop hazards. @dereekb/* siblings are
      // real ESM with real named exports once their `import` condition points at the ESM build.
      if (specifier.startsWith('.') || specifier.startsWith('node:') || specifier.startsWith('@dereekb/')) {
        continue;
      }

      if (!bySpecifier.has(specifier)) {
        bySpecifier.set(specifier, { names: new Set(), bundles: new Set() });
      }

      const entry = bySpecifier.get(specifier);

      for (const raw of match[1].split(',')) {
        const name = raw
          .trim()
          .split(/\s+as\s+/)[0]
          .trim();

        if (name) {
          entry.names.add(name);
        }
      }

      entry.bundles.add(bundle);
    }
  }

  return bySpecifier;
}

const bundles = [...new Set(DIST_DIRS.flatMap((dir) => collectBundles(dir)))];

if (!bundles.length) {
  console.error(`check-esm-named-imports: no ESM bundles found under ${DIST_DIRS.join(', ')} — build first.`);
  process.exit(1);
}

const bySpecifier = collectNamedImports(bundles);
const require = createRequire(join(process.cwd(), 'package.json'));
const failures = [];
let checked = 0;
let skipped = 0;

for (const [specifier, { names, bundles: importers }] of bySpecifier) {
  if (EXEMPT.has(specifier)) {
    skipped++;
    continue;
  }

  let namespace;

  // Angular libraries log `JIT compilation failed for ...` while being imported outside an
  // Angular app. That noise is expected and irrelevant here, so keep it out of the gate output.
  const console_ = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = () => undefined;

  try {
    namespace = await import(specifier);
  } catch (e) {
    Object.assign(console, console_);
    // A specifier that cannot be imported here at all is out of scope: Angular libraries throw
    // JIT-compiler errors outside an Angular app, and browser-only packages reference `window`.
    // Neither is the defect this check exists for, and a false failure would train people to
    // ignore it. Resolution failures ARE reported, since a missing dependency is real.
    try {
      require.resolve(specifier);
      skipped++;
    } catch {
      failures.push({ specifier, names: [...names], importers: [...importers], reason: 'cannot be resolved' });
    }

    continue;
  }

  Object.assign(console, console_);
  checked++;

  const bindable = new Set(Object.keys(namespace));
  const missing = [...names].filter((name) => !bindable.has(name));

  if (missing.length) {
    failures.push({
      specifier,
      names: missing,
      importers: [...importers],
      reason: `Node's namespace for this module exposes only: ${[...bindable].slice(0, 8).join(', ')}`
    });
  }
}

console.log(`check-esm-named-imports: ${bundles.length} ESM bundles, ${bySpecifier.size} third-party specifiers (${checked} verified, ${skipped} skipped).`);

if (!failures.length) {
  console.log('All named imports can bind under plain Node.');
  process.exit(0);
}

console.error(`\n${failures.length} specifier(s) name-import bindings Node cannot bind:\n`);

for (const failure of failures) {
  console.error(`  ${failure.specifier}`);
  console.error(`      unbindable: ${failure.names.join(', ')}`);
  console.error(`      ${failure.reason}`);
  console.error(`      imported by: ${failure.importers.join(', ')}`);
  console.error(`      fix: import the namespace and unwrap \`default\` when present — see packages/date/src/lib/rrule/rrule.interop.ts\n`);
}

process.exit(1);
