/**
 * Syncs peerDependencies in all packages/ package.json files:
 * - @dereekb/* dependencies are set to "*"
 * - All other dependencies are matched to the version in the root package.json
 *
 * Usage: node tools/scripts/sync-peer-deps.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { glob } from 'glob';

const ROOT_DIR = resolve(import.meta.dirname, '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

// Read root package.json to build version map
const rootPkg = JSON.parse(readFileSync(resolve(ROOT_DIR, 'package.json'), 'utf-8'));
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
      // @dereekb packages always use "*"
      if (currentVersion !== '*') {
        updates.push({ dep, from: currentVersion, to: '*' });
        pkg.peerDependencies[dep] = '*';
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
