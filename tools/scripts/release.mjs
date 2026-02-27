/**
 * Release script that uses conventional-recommended-bump to determine the next
 * version from conventional commits, then applies it via the Nx Release
 * programmatic API. Changelog is generated directly with conventional-changelog.
 *
 * Usage:
 *   node tools/scripts/release.mjs                          # dry run (default)
 *   node tools/scripts/release.mjs --dry-run=false          # actual release
 *   node tools/scripts/release.mjs --version 13.0.1         # explicit version override
 *   node tools/scripts/release.mjs --verbose                # verbose output
 *   node tools/scripts/release.mjs --skip-publish           # skip npm publish step
 */

import { createRequire } from 'module';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ConventionalChangelog } from 'conventional-changelog';
import { Bumper } from 'conventional-recommended-bump';
import semver from 'semver';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const require = createRequire(import.meta.url);
const { releasePublish, releaseVersion } = require('nx/release');

const CHANGELOG_PATH = 'CHANGELOG.md';

// -- CLI args ----------------------------------------------------------------

const argv = await yargs(hideBin(process.argv))
  .version(false)
  .option('dry-run', {
    alias: 'd',
    description: 'Preview the release without making changes',
    type: 'boolean',
    default: true,
  })
  .option('verbose', {
    description: 'Enable verbose output',
    type: 'boolean',
    default: false,
  })
  .option('version', {
    description: 'Explicit version to use (skips commit analysis)',
    type: 'string',
  })
  .option('skip-publish', {
    description: 'Skip the npm publish step',
    type: 'boolean',
    default: false,
  })
  .parseAsync();

const dryRun = argv.dryRun;
const verbose = argv.verbose;
const skipPublish = argv.skipPublish;

console.log(`\nRelease mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

// -- Resolve the -dev tag (used for both version analysis and changelog) ------

// Find the last stable tag (for version calculation) and its -dev counterpart (for commit comparison).
// The -dev tags live on develop and mark where release prep happened, so commits after that are new.
// (main diverges via force-merge, so main..develop includes the full history — the -dev tag is the correct anchor.)
const allTags = execSync('git tag --list "v*" --sort=-v:refname', { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(Boolean);

const lastStableTag = allTags.find((tag) => {
  const ver = semver.parse(tag.replace(/^v/, ''));
  return ver && ver.prerelease.length === 0;
});

if (!lastStableTag) {
  console.error('No stable semver tag found.');
  process.exit(1);
}

const lastVersion = lastStableTag.replace(/^v/, '');
const devTag = `${lastStableTag}-dev`;
const fromTag = allTags.includes(devTag) ? devTag : lastStableTag;

if (!semver.valid(lastVersion)) {
  console.error(`Invalid semver tag found: ${lastStableTag}`);
  process.exit(1);
}

console.log(`Last stable tag: ${lastStableTag}`);
console.log(`Comparing from:  ${fromTag}\n`);

// -- Step 1: Determine next version -----------------------------------------

let nextVersion;

if (argv.version) {
  nextVersion = argv.version;
  console.log(`Using explicit version: ${nextVersion}\n`);
} else {
  console.log('Analyzing commits with conventional-recommended-bump...\n');

  const bumper = new Bumper(process.cwd()).tag(fromTag).loadPreset('angular');
  const recommendation = await bumper.bump();

  if (!recommendation.releaseType) {
    console.log('No release needed (no relevant commits found).');
    process.exit(0);
  }

  nextVersion = semver.inc(lastVersion, recommendation.releaseType);
  const commitCount = recommendation.commits?.length ?? 0;

  console.log(`Commits since:   ${commitCount}`);
  console.log(`Bump type:       ${recommendation.releaseType}`);
  console.log(`Reason:          ${recommendation.reason || 'N/A'}`);
  console.log(`Next version:    v${nextVersion}\n`);
}

// -- Step 2: Apply version via Nx Release ------------------------------------

console.log('Running Nx releaseVersion...\n');

const { releaseGraph } = await releaseVersion({
  specifier: nextVersion,
  dryRun,
  verbose,
});

// -- Step 3: Generate changelog with conventional-changelog ------------------

console.log('\nGenerating changelog...\n');

const changelogChunks = [];

for await (const chunk of new ConventionalChangelog(process.cwd())
  .loadPreset('angular')
  .commits({ from: fromTag })
  .context({ version: nextVersion })
  .write()) {
  changelogChunks.push(chunk);
}

const newEntry = changelogChunks.join('');

if (verbose || dryRun) {
  console.log('--- Changelog entry ---');
  console.log(newEntry);
  console.log('--- End changelog entry ---\n');
}

if (!dryRun) {
  const existing = existsSync(CHANGELOG_PATH) ? readFileSync(CHANGELOG_PATH, 'utf-8') : '';
  writeFileSync(CHANGELOG_PATH, newEntry + '\n' + existing);
  console.log(`Updated ${CHANGELOG_PATH}\n`);
} else {
  console.log(`Would prepend to ${CHANGELOG_PATH} (dry run)\n`);
}

// -- Step 4: Publish (optional) ----------------------------------------------

if (skipPublish) {
  console.log('Skipping publish (--skip-publish).\n');
} else {
  console.log('Running Nx releasePublish...\n');

  const publishResults = await releasePublish({
    releaseGraph,
    dryRun,
    verbose,
  });

  const allSucceeded = Object.values(publishResults).every((r) => r.code === 0);

  if (!allSucceeded) {
    const failed = Object.entries(publishResults)
      .filter(([, r]) => r.code !== 0)
      .map(([name]) => name);
    console.error(`\nPublish failed for: ${failed.join(', ')}`);
    process.exit(1);
  }
}

console.log(`\nRelease ${dryRun ? '(dry run) ' : ''}complete: v${nextVersion}\n`);
