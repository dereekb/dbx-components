/**
 * Syncs peerDependencies in all packages/ package.json files to match
 * the versions in the root package.json.
 *
 * - @dereekb/* dependencies are set to the root package.json version (use --skip-internal to leave them unchanged)
 * - All other dependencies are matched to the version in the root package.json
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

let totalUpdated = 0;

for (const pkgPath of packageFiles) {
  const relPath = relative(ROOT_DIR, pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  if (!pkg.peerDependencies || Object.keys(pkg.peerDependencies).length === 0) {
    continue;
  }

  let changed = false;
  const updates = [];

  for (const [dep, currentVersion] of Object.entries(pkg.peerDependencies)) {
    if (dep.startsWith('@dereekb/')) {
      // Set @dereekb packages to the root package.json version unless --skip-internal
      if (!SKIP_INTERNAL && currentVersion !== rootVersion) {
        updates.push({ dep, from: currentVersion, to: rootVersion });
        pkg.peerDependencies[dep] = rootVersion;
        changed = true;
      }
    } else {
      // Sync from root package.json
      const rootVersion = rootVersions[dep];

      if (rootVersion) {
        if (currentVersion !== rootVersion) {
          updates.push({ dep, from: currentVersion, to: rootVersion });
          pkg.peerDependencies[dep] = rootVersion;
          changed = true;
        }
      } else {
        console.warn(`  ⚠ ${relPath}: "${dep}" not found in root package.json (keeping "${currentVersion}")`);
      }
    }
  }

  if (changed) {
    totalUpdated++;
    console.log(`\n${relPath}:`);

    for (const { dep, from, to } of updates) {
      console.log(`  ${dep}: "${from}" → "${to}"`);
    }

    if (!DRY_RUN) {
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Updated ${totalUpdated} package.json file(s).`);