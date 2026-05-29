/**
 * Scans TypeScript imports in all packages/ directories and updates
 * peerDependencies and devDependencies in each package.json to match
 * actual usage in source code.
 *
 * For each package.json under packages/:
 *   - peerDependencies: external packages imported in non-spec .ts files
 *     (including child sub-package directories)
 *   - devDependencies: external packages imported ONLY in .spec.ts files
 *     that aren't already in peerDependencies (excludes test runners)
 *
 * Versions are resolved from the root package.json. Internal @dereekb/*
 * packages use the root package version (e.g., 13.0.0).
 *
 * Usage: node tools/scripts/update-peer-deps-from-imports.mjs [--dry-run] [--remove-unused]
 *
 * Flags:
 *   --dry-run        Preview changes without writing files
 *   --remove-unused  Also remove peer/devDependencies not found in imports
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { glob } from 'glob';
import { builtinModules } from 'node:module';

const ROOT_DIR = resolve(import.meta.dirname, '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');
const REMOVE_UNUSED = process.argv.includes('--remove-unused');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Read root package.json for version resolution
const rootPkg = JSON.parse(readFileSync(resolve(ROOT_DIR, 'package.json'), 'utf-8'));
const rootVersion = rootPkg.version;
const rootVersions = {
  ...rootPkg.dependencies,
  ...rootPkg.devDependencies
};

// Node built-in modules (skip these — they don't need to be in package.json)
const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

// Test-runner packages excluded from devDependencies
// (these are workspace-level devDependencies, not per-package)
const TEST_RUNNER_PACKAGES = new Set(['vitest', '@vitest/expect', '@vitest/runner', '@vitest/utils', '@vitest/spy']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the npm package name from an import specifier.
 *
 * Scoped:   '@angular/core/testing' → '@angular/core'
 * Unscoped: 'rxjs/operators'       → 'rxjs'
 */
function getPackageName(importPath) {
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  return importPath.split('/')[0];
}

/**
 * True if the import path refers to a Node.js built-in module.
 */
function isNodeBuiltin(importPath) {
  if (importPath.startsWith('node:')) return true;
  const pkg = getPackageName(importPath);
  return NODE_BUILTINS.has(pkg);
}

/**
 * True if the import should be skipped (relative path, node_modules path, etc.)
 */
function isSkippedImport(p) {
  return p.startsWith('.') || p.startsWith('/') || p.startsWith('node_modules');
}

/**
 * True if `importPath` is a self-reference for `ownPkgName`.
 *
 * For parent package '@dereekb/util':
 *   '@dereekb/util'       → true (exact match)
 *   '@dereekb/util/fetch' → true (sub-entry-point)
 *
 * For sub-package '@dereekb/util/fetch':
 *   '@dereekb/util/fetch' → true
 *   '@dereekb/util'       → false (that's the parent — a real dep)
 */
function isSelfReference(importPath, ownPkgName) {
  return importPath === ownPkgName || importPath.startsWith(ownPkgName + '/');
}

/**
 * Tokeniser-style pass that walks the source once and erases:
 *   - line comments (`// ...` to end of line)
 *   - block comments (`/* ... *​/`)
 *   - the contents of template literals (preserves outer backticks so later
 *     passes can still see expression boundaries)
 * Single- and double-quoted string literals are passed through unchanged so
 * `from 'X'` import targets survive intact.
 *
 * Doing comments and template literals in one pass is required because each
 * can appear inside the other in real source — e.g. `\`// not a comment\``
 * versus `// has a \` backtick in a comment` — and stripping either one first
 * mangles the other.
 */
function stripCommentsAndTemplateLiterals(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "'" || c === '"') {
      const quote = c;
      out += quote;
      i += 1;
      while (i < n) {
        const ch = source[i];
        if (ch === '\\') {
          out += ch;
          if (i + 1 < n) out += source[i + 1];
          i += 2;
          continue;
        }
        if (ch === '\n') break;
        out += ch;
        if (ch === quote) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      out += '`';
      i += 1;
      while (i < n) {
        const ch = source[i];
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === '`') {
          out += '`';
          i += 1;
          break;
        }
        if (ch === '$' && source[i + 1] === '{') {
          i += 2;
          let depth = 1;
          while (i < n && depth > 0) {
            const c2 = source[i];
            if (c2 === '{') depth += 1;
            else if (c2 === '}') depth -= 1;
            i += 1;
          }
          continue;
        }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Extract all non-relative import specifiers from a TypeScript file.
 */
function extractImportsFromFile(filePath) {
  const content = stripCommentsAndTemplateLiterals(readFileSync(filePath, 'utf-8'));
  const imports = new Set();

  // import { ... } from 'pkg' / export { ... } from 'pkg' / type imports / re-exports.
  // Anchored to a statement start (line start or after `;`) so a `from 'X'` substring
  // inside a string argument (e.g. `.replace("...from 'X'", ...)`) is not counted.
  // The character class `[^;]` allows newlines for multi-line import statements.
  for (const m of content.matchAll(/(?:^|[;{}])\s*(?:import|export)\b[^;]*?\bfrom\s+['"]([^'"]+)['"]/gm)) {
    if (!isSkippedImport(m[1])) imports.add(m[1]);
  }

  // Side-effect imports `import 'pkg';` (no identifier between `import` and the quote).
  for (const m of content.matchAll(/(?:^|[;{}])\s*import\s+['"]([^'"]+)['"]/gm)) {
    if (!isSkippedImport(m[1])) imports.add(m[1]);
  }

  // Dynamic import('pkg')
  for (const m of content.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!isSkippedImport(m[1])) imports.add(m[1]);
  }

  return imports;
}

/**
 * Resolve a version string for `pkgName` from root package.json.
 * Internal @dereekb/* packages get the monorepo version.
 */
function resolveVersion(pkgName) {
  if (pkgName.startsWith('@dereekb/')) return rootVersion;
  return rootVersions[pkgName] || null;
}

/**
 * Return a new object with keys sorted alphabetically.
 */
function sortKeys(obj) {
  const sorted = {};

  for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
    sorted[key] = obj[key];
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Discover all package.json files under packages/
const packageFiles = glob.sync('packages/**/package.json', {
  cwd: ROOT_DIR,
  ignore: ['**/node_modules/**'],
  absolute: true
});

const appPackageFiles = glob.sync('apps/**/package.json', {
  cwd: ROOT_DIR,
  ignore: ['**/node_modules/**'],
  absolute: true
});

if (REMOVE_UNUSED) {
  console.log('⚠  --remove-unused is enabled: dependencies not found in imports will be removed.\n');
}

let totalUpdated = 0;

const targetFiles = [...appPackageFiles, ...packageFiles];

for (const pkgPath of targetFiles) {
  const relPath = relative(ROOT_DIR, pkgPath);
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const ownPkgName = pkg.name;
  // const isApp = pkgPath.includes('/apps/');

  if (!ownPkgName) continue;

  // Find all .ts source files in this package's directory tree
  const tsFiles = glob.sync('**/*.ts', {
    cwd: pkgDir,
    ignore: ['**/node_modules/**', '**/dist/**'],
    absolute: true
  });

  if (tsFiles.length === 0) continue;

  // -----------------------------------------------------------------------
  // 1. Collect normalised package names, split by prod vs spec
  // -----------------------------------------------------------------------
  const prodPkgs = new Set();
  const specPkgs = new Set();

  for (const tsFile of tsFiles) {
    const isSpec = tsFile.endsWith('.spec.ts');
    const rawImports = extractImportsFromFile(tsFile);

    for (const raw of rawImports) {
      if (isNodeBuiltin(raw)) continue;
      if (isSelfReference(raw, ownPkgName)) continue;

      const pkgName = getPackageName(raw);
      (isSpec ? specPkgs : prodPkgs).add(pkgName);
    }
  }

  // spec-only = imported in spec files but NOT in production files
  const specOnlyPkgs = new Set([...specPkgs].filter((p) => !prodPkgs.has(p)));

  // Remove test runners from spec-only (they are workspace-level devDeps)
  for (const tr of TEST_RUNNER_PACKAGES) {
    specOnlyPkgs.delete(tr);
  }

  // -----------------------------------------------------------------------
  // 2. Build target peerDependencies & devDependencies
  // -----------------------------------------------------------------------
  const existingDeps = pkg.dependencies || {};
  const existingPeerDeps = pkg.peerDependencies || {};
  const existingDevDeps = pkg.devDependencies || {};

  // Target peer deps = production imports (minus anything already in dependencies)
  const targetPeerDeps = {};
  for (const dep of prodPkgs) {
    if (existingDeps[dep]) continue; // bundled dependency — skip
    const version = resolveVersion(dep);
    if (version) {
      targetPeerDeps[dep] = version;
    } else if (existingPeerDeps[dep]) {
      // Can't find in root — keep existing version
      targetPeerDeps[dep] = existingPeerDeps[dep];
    } else {
      console.warn(`  ⚠ ${relPath}: "${dep}" imported but not in root package.json — skipping`);
    }
  }

  // Target dev deps = spec-only imports (minus peer deps and bundled deps)
  const targetDevDeps = {};
  for (const dep of specOnlyPkgs) {
    if (existingDeps[dep]) continue;
    if (targetPeerDeps[dep]) continue;
    const version = resolveVersion(dep);
    if (version) {
      targetDevDeps[dep] = version;
    } else if (existingDevDeps[dep]) {
      targetDevDeps[dep] = existingDevDeps[dep];
    } else {
      console.warn(`  ⚠ ${relPath}: "${dep}" (spec-only) not in root package.json — skipping`);
    }
  }

  // -----------------------------------------------------------------------
  // 3. Compute delta
  // -----------------------------------------------------------------------
  const changes = [];

  // Additions to peerDependencies
  for (const [dep, version] of Object.entries(targetPeerDeps)) {
    if (!existingPeerDeps[dep]) {
      changes.push({ action: 'add', section: 'peerDependencies', dep, version });
    }
  }

  // Additions to devDependencies
  for (const [dep, version] of Object.entries(targetDevDeps)) {
    if (!existingDevDeps[dep]) {
      changes.push({ action: 'add', section: 'devDependencies', dep, version });
    }
  }

  // Promotions: currently in devDependencies but should be in peerDependencies
  for (const dep of Object.keys(existingDevDeps)) {
    if (targetPeerDeps[dep] && !existingPeerDeps[dep]) {
      changes.push({ action: 'promote', section: 'devDependencies → peerDependencies', dep, version: targetPeerDeps[dep] });
    }
  }

  // Removals (opt-in)
  if (REMOVE_UNUSED) {
    for (const dep of Object.keys(existingPeerDeps)) {
      if (!targetPeerDeps[dep]) {
        changes.push({ action: 'remove', section: 'peerDependencies', dep });
      }
    }
    for (const dep of Object.keys(existingDevDeps)) {
      if (!targetDevDeps[dep] && !targetPeerDeps[dep]) {
        changes.push({ action: 'remove', section: 'devDependencies', dep });
      }
    }
  }

  if (changes.length === 0) continue;

  // -----------------------------------------------------------------------
  // 4. Print & apply
  // -----------------------------------------------------------------------
  totalUpdated++;
  console.log(`\n${relPath}:`);

  for (const c of changes) {
    switch (c.action) {
      case 'add':
        console.log(`  + [${c.section}] ${c.dep}: "${c.version}"`);
        if (!DRY_RUN) {
          if (!pkg[c.section]) pkg[c.section] = {};
          pkg[c.section][c.dep] = c.version;
        }
        break;

      case 'promote':
        console.log(`  ↑ [${c.section}] ${c.dep}: "${c.version}"`);
        if (!DRY_RUN) {
          delete pkg.devDependencies[c.dep];
          if (!pkg.peerDependencies) pkg.peerDependencies = {};
          pkg.peerDependencies[c.dep] = c.version;
        }
        break;

      case 'remove':
        console.log(`  - [${c.section}] ${c.dep}`);
        if (!DRY_RUN) {
          delete pkg[c.section][c.dep];
        }
        break;
    }
  }

  // Sort and write
  if (!DRY_RUN) {
    if (pkg.peerDependencies) {
      pkg.peerDependencies = sortKeys(pkg.peerDependencies);
    }

    if (pkg.devDependencies) {
      if (Object.keys(pkg.devDependencies).length === 0) {
        delete pkg.devDependencies;
      } else {
        pkg.devDependencies = sortKeys(pkg.devDependencies);
      }
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Updated ${totalUpdated} package.json file(s).`);
