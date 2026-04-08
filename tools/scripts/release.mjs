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

import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ConventionalChangelog } from 'conventional-changelog';
import { Bumper } from 'conventional-recommended-bump';
import semver from 'semver';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const githubReponsitoryOwner = 'dereekb';
const githubReponsitoryName = 'dbx-components';

const require = createRequire(import.meta.url);
const { releasePublish, releaseVersion } = require('nx/release');

const CHANGELOG_PATH = 'CHANGELOG.md';

// Type labels for the changelog (angular preset discards anything that isn't feat/fix/perf/revert by default)
const TYPE_LABELS = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  revert: 'Reverts',
  refactor: 'Code Refactoring',
  build: 'Build System',
  docs: 'Documentation',
  style: 'Styles',
  test: 'Tests',
  ci: 'Continuous Integration',
  minor: 'Minor Changes',
  merge: 'Merges',
  release: 'Releases',
  checkpoint: 'Checkpoints',
  demo: 'Demo'
};

// -- CLI args ----------------------------------------------------------------

const argv = await yargs(hideBin(process.argv))
  .version(false)
  .option('dry-run', {
    alias: 'd',
    description: 'Preview the release without making changes',
    type: 'boolean',
    default: true
  })
  .option('verbose', {
    description: 'Enable verbose output',
    type: 'boolean',
    default: false
  })
  .option('version', {
    description: 'Explicit version to use (skips commit analysis)',
    type: 'string'
  })
  .option('skip-publish', {
    description: 'Skip the npm publish step',
    type: 'boolean',
    default: false
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
const allTags = execSync('git tag --list "v*" --sort=-v:refname', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

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
  verbose
});

// -- Step 3: Generate changelog with conventional-changelog ------------------

console.log('\nGenerating changelog...\n');

const changelogChunks = [];

for await (const chunk of new ConventionalChangelog(process.cwd())
  .loadPreset('angular')
  .commits({ from: fromTag })
  .context({
    version: nextVersion,
    host: 'https://github.com',
    owner: githubReponsitoryOwner,
    repository: githubReponsitoryName,
    linkReferences: true
  })
  .writer({
    // Use "- " instead of "* " for list items
    commitPartial:
      '- {{#if scope}}**{{scope}}:** {{/if}}{{#if subject}}{{subject}}{{else}}{{header}}{{/if}} ({{#if @root.linkReferences}}[{{shortHash}}]({{@root.host}}/{{@root.owner}}/{{@root.repository}}/commit/{{hash}}){{else}}{{shortHash}}{{/if}}){{#if references}}, closes{{#each references}} {{#if @root.linkReferences}}[{{#if this.owner}}{{this.owner}}/{{/if}}{{this.repository}}#{{this.issue}}]({{@root.host}}/{{#if this.owner}}{{this.owner}}{{else}}{{@root.owner}}{{/if}}/{{#if this.repository}}{{this.repository}}{{else}}{{@root.repository}}{{/if}}/issues/{{this.issue}}){{else}}{{#if this.owner}}{{this.owner}}/{{/if}}{{this.repository}}#{{this.issue}}{{/if}}{{/each}}{{/if}}\n',
    // Override the angular transform to include all commit types, not just feat/fix/perf/revert
    transform: (commit) => {
      const notes = commit.notes.map((note) => ({
        ...note,
        title: 'BREAKING CHANGES'
      }));

      const type = TYPE_LABELS[commit.type] || commit.type;
      const scope = commit.scope === '*' ? '' : commit.scope;
      const shortHash = typeof commit.hash === 'string' ? commit.hash.substring(0, 8) : commit.shortHash;

      let { subject } = commit;

      if (typeof subject === 'string') {
        subject = subject.replace(/#([0-9]+)/g, (_, issue) => `[#${issue}](https://github.com/${githubReponsitoryOwner}/${githubReponsitoryName}/issues/${issue})`);
      }

      return { notes, type, scope, shortHash, subject, references: commit.references };
    }
  })
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

// -- Step 4: Stage and commit ------------------------------------------------

// Build the commit message with a detailed body listing each individual commit
const commitSubject = `release($workspace): v${nextVersion} release`;
const commitLog = execSync(`git log ${fromTag}..HEAD --format="%s%n%n%b" --no-merges`, {
  encoding: 'utf-8'
}).trim();

const commitMessage = commitLog ? `${commitSubject}\n\n${commitLog}` : commitSubject;

const releaseTag = `v${nextVersion}`;

if (!dryRun) {
  console.log('Staging and committing release changes...\n');
  execSync('git add -A', { stdio: 'inherit' });
  execFileSync('git', ['commit', '--no-verify', '-m', commitMessage], { stdio: 'inherit' });

  console.log(`\nTagging ${releaseTag}...\n`);
  execFileSync('git', ['tag', '-a', releaseTag, '-m', releaseTag], { stdio: 'inherit' });
} else {
  console.log('--- Commit message ---');
  console.log(commitMessage);
  console.log('--- End commit message ---\n');
  console.log(`Would tag: ${releaseTag}\n`);
}

// -- Step 5: Publish (optional) ----------------------------------------------
// Publishes using the ci-publish-npmjs target

if (skipPublish) {
  console.log('Skipping publish (--skip-publish).\n');
} else {
  console.log('Running Nx releasePublish...\n');

  const publishResults = await releasePublish({
    releaseGraph,
    dryRun,
    verbose
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
