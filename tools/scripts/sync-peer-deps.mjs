/**
 * Syncs peerDependencies and devDependencies in all packages/ package.json files
 * to match the versions in the root package.json.
 *
 * - @dereekb/* dependencies are set to the root package.json version (use --skip-internal to leave them unchanged)
 * - All other dependencies are matched to the version in the root package.json
 * - For devDependencies, the existing ^ or ~ prefix is preserved unless the current value is a URL
 *
 * Usage: node tools/scripts/sync-peer-deps.mjs [--dry-run] [--skip-internal]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { glob } from 'glob';

const ROOT_DIR = resolve(import.meta.dirname, '..', '..');

if (process.env.SKIP_SYNC_PEER_DEPS === 'true') {
  console.log('SKIP_SYNC_PEER_DEPS is set, skipping.');
  process.exit(0);
}

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_INTERNAL = process.argv.includes('--skip-internal');

// Read root package.json to build version map
const rootPkg = JSON.parse(readFileSync(resolve(ROOT_DIR, 'package.json'), 'utf-8'));
const rootVersion = rootPkg.version;
const rootVersions = {
  ...rootPkg.dependencies,
  ...rootPkg.devDependencies
};

// Find all package.json files under packages/
const packageFiles = glob.sync('packages/**/package.json', {
  cwd: ROOT_DIR,
  ignore: ['**/node_modules/**'],
  absolute: true
});

/**
 * Returns true if the version string is a URL (file:, https:, git+, ssh:, etc.)
 */
function isUrl(version) {
  return /^(https?:|file:|git[+:]|ssh:|link:)/.test(version) || version.includes('://');
}

/**
 * Extracts the range prefix (^ or ~) from a version string.
 */
function extractPrefix(version) {
  if (version.startsWith('^')) return '^';
  if (version.startsWith('~')) return '~';
  return '';
}

/**
 * Strips the leading ^ or ~ from a version string.
 */
function stripPrefix(version) {
  return version.replace(/^[\^~]/, '');
}

/**
 * Computes the target version for a devDependency, preserving the existing
 * ^ or ~ prefix. If the current value is a URL, the root version is used as-is.
 */
function resolveDevDepVersion(currentVersion, rootVer) {
  if (isUrl(currentVersion)) {
    return rootVer;
  }

  const prefix = extractPrefix(currentVersion);
  const bareRoot = stripPrefix(rootVer);
  return prefix + bareRoot;
}

let totalUpdated = 0;

for (const pkgPath of packageFiles) {
  const relPath = relative(ROOT_DIR, pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  const hasPeerDeps = pkg.peerDependencies && Object.keys(pkg.peerDependencies).length > 0;
  const hasDevDeps = pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0;

  if (!hasPeerDeps && !hasDevDeps) {
    continue;
  }

  let changed = false;
  const updates = [];

  // Sync peerDependencies
  if (hasPeerDeps) {
    for (const [dep, currentVersion] of Object.entries(pkg.peerDependencies)) {
      if (dep.startsWith('@dereekb/')) {
        if (!SKIP_INTERNAL && currentVersion !== rootVersion) {
          updates.push({ section: 'peerDependencies', dep, from: currentVersion, to: rootVersion });
          pkg.peerDependencies[dep] = rootVersion;
          changed = true;
        }
      } else {
        const rootVer = rootVersions[dep];

        if (rootVer) {
          if (currentVersion !== rootVer) {
            updates.push({ section: 'peerDependencies', dep, from: currentVersion, to: rootVer });
            pkg.peerDependencies[dep] = rootVer;
            changed = true;
          }
        } else {
          console.warn(`  ⚠ ${relPath}: peerDependencies "${dep}" not found in root package.json (keeping "${currentVersion}")`);
        }
      }
    }
  }

  // Sync devDependencies
  if (hasDevDeps) {
    for (const [dep, currentVersion] of Object.entries(pkg.devDependencies)) {
      if (dep.startsWith('@dereekb/')) {
        if (!SKIP_INTERNAL && currentVersion !== rootVersion) {
          updates.push({ section: 'devDependencies', dep, from: currentVersion, to: rootVersion });
          pkg.devDependencies[dep] = rootVersion;
          changed = true;
        }
      } else {
        const rootVer = rootVersions[dep];

        if (rootVer) {
          const newVersion = resolveDevDepVersion(currentVersion, rootVer);

          if (currentVersion !== newVersion) {
            updates.push({ section: 'devDependencies', dep, from: currentVersion, to: newVersion });
            pkg.devDependencies[dep] = newVersion;
            changed = true;
          }
        } else {
          console.warn(`  ⚠ ${relPath}: devDependencies "${dep}" not found in root package.json (keeping "${currentVersion}")`);
        }
      }
    }
  }

  if (changed) {
    totalUpdated++;
    console.log(`\n${relPath}:`);

    for (const { section, dep, from, to } of updates) {
      console.log(`  [${section}] ${dep}: "${from}" → "${to}"`);
    }

    if (!DRY_RUN) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Updated ${totalUpdated} package.json file(s).`);