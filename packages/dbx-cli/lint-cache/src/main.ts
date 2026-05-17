/**
 * Build- and query-time CLI for caching ESLint results of one or more Nx
 * projects so multi-agent lint cleanup does not re-run nx lint per agent.
 *
 * Subcommands:
 *   build       — lint a single project and write its grouped cache.
 *   build-many  — lint every lint-capable project (with optional include/exclude
 *                 filters) and write per-project caches plus an aggregate
 *                 index.json.
 *   query       — filter the cache for a project and print summary / rules /
 *                 files / messages / json.
 *   list-projects — preview which projects build-many would target after
 *                 filters, without running ESLint.
 *
 * Cache files are written under --output-dir (default `.lint-cache/`,
 * workspace-relative).
 */

import { resolve } from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { runBuild } from './build';
import { filterProjects, runBuildMany, type BuildManyProgressEvent } from './build-many';
import { renderResult, type OutputFormat } from './format';
import { listProjects } from './project-lookup';
import { runQuery } from './query';
import { cacheFileName } from './types';

const FORMAT_CHOICES: readonly OutputFormat[] = ['summary', 'rules', 'files', 'messages', 'json'];
const SEVERITY_CHOICES = ['error', 'warning'] as const;

interface CommonArgs {
  readonly workspace: string | undefined;
}

await yargs(hideBin(process.argv))
  .scriptName('dbx-cli-lint-cache')
  .usage('$0 <command> [options]')
  .command(
    'build <project>',
    'Run ESLint for a project and write the grouped result cache.',
    (y) =>
      y
        .positional('project', { type: 'string', describe: 'Nx project name', demandOption: true })
        .option('output-dir', { type: 'string', default: '.lint-cache', describe: 'Directory the cache file is written into (workspace-relative).' })
        .option('workspace', { type: 'string', describe: 'Workspace root (defaults to cwd).' })
        .option('nx-arg', { type: 'array', string: true, describe: 'Extra argument passed through to `nx run <project>:lint` (repeatable).' })
        .option('fix', { type: 'boolean', default: false, describe: 'Run ESLint with --fix; remaining (non-fixable) issues are still cached.' })
        .option('quiet', { type: 'boolean', default: false, describe: 'Suppress the post-build summary line.' }),
    async (args) => {
      const workspaceRoot = resolveWorkspaceRoot(args);
      const outputDir = resolve(workspaceRoot, args['output-dir']);
      const { cachePath, cache } = await runBuild({
        project: args.project,
        workspaceRoot,
        outputDir,
        nxArgs: args['nx-arg'],
        fix: args.fix
      });
      if (!args.quiet) {
        console.log(`[wrote] ${cachePath}`);
        console.log(`Summary: ${cache.errorCount} errors · ${cache.warningCount} warnings · ${cache.filesWithIssues}/${cache.fileCount} files with issues${args.fix ? ' (after --fix)' : ''}`);
      }
    }
  )
  .command(
    'query <project>',
    "Filter and display messages from a project's cached lint result.",
    (y) =>
      y
        .positional('project', { type: 'string', describe: 'Nx project name', demandOption: true })
        .option('cache-dir', { type: 'string', default: '.lint-cache', describe: 'Directory the cache file lives in (workspace-relative).' })
        .option('workspace', { type: 'string', describe: 'Workspace root (defaults to cwd).' })
        .option('rule', { type: 'array', string: true, describe: 'Filter to one or more rule IDs (repeatable). OR-ed.' })
        .option('severity', { choices: SEVERITY_CHOICES, describe: 'Filter to errors or warnings only.' })
        .option('file', { type: 'string', describe: 'Substring filter against the file path; supports * and ** glob chars.' })
        .option('message', { type: 'string', describe: 'Substring filter against the message text (case-insensitive).' })
        .option('limit', { type: 'number', describe: 'Limit the printed messages slice (totalMatched still reflects the full match count).' })
        .option('format', { choices: FORMAT_CHOICES, default: 'summary' as OutputFormat, describe: 'Output format.' }),
    (args) => {
      const workspaceRoot = resolveWorkspaceRoot(args);
      const cacheDir = resolve(workspaceRoot, args['cache-dir']);
      const cachePath = resolve(cacheDir, cacheFileName(args.project));
      const result = runQuery(cachePath, {
        rule: args.rule,
        severity: args.severity,
        file: args.file,
        message: args.message,
        limit: args.limit
      });
      console.log(renderResult(args.format, result));
    }
  )
  .command(
    'build-many',
    'Run ESLint for every project with a lint target (with optional filters) and write per-project caches plus an aggregate index.json.',
    (y) =>
      y
        .option('output-dir', { type: 'string', default: '.lint-cache', describe: 'Directory the cache files are written into (workspace-relative).' })
        .option('workspace', { type: 'string', describe: 'Workspace root (defaults to cwd).' })
        .option('include', { type: 'array', string: true, default: [] as readonly string[], describe: 'Only build projects whose name matches one of these patterns (substring or *-glob). Repeatable.' })
        .option('exclude', { type: 'array', string: true, default: [] as readonly string[], describe: 'Skip projects whose name matches one of these patterns (substring or *-glob). Repeatable.' })
        .option('concurrency', { type: 'number', default: 4, describe: 'Number of `nx run <p>:lint` processes to run in parallel.' })
        .option('continue-on-error', { type: 'boolean', default: true, describe: 'Continue past per-project failures and record them in index.json.' })
        .option('nx-arg', { type: 'array', string: true, describe: 'Extra argument passed through to each `nx run <project>:lint` (repeatable).' })
        .option('fix', { type: 'boolean', default: false, describe: 'Run ESLint with --fix on every targeted project; remaining (non-fixable) issues are still cached.' })
        .option('quiet', { type: 'boolean', default: false, describe: 'Suppress per-project progress output.' }),
    async (args) => {
      const workspaceRoot = resolveWorkspaceRoot(args);
      const outputDir = resolve(workspaceRoot, args['output-dir']);
      const include = (args.include ?? []) as readonly string[];
      const exclude = (args.exclude ?? []) as readonly string[];
      const result = await runBuildMany({
        workspaceRoot,
        outputDir,
        include,
        exclude,
        concurrency: args.concurrency,
        continueOnError: args['continue-on-error'],
        nxArgs: args['nx-arg'],
        fix: args.fix,
        onProgress: args.quiet ? undefined : printProgress
      });
      if (!args.quiet) {
        const failed = result.projects.filter((p) => p.error != null).length;
        console.log('');
        console.log(`[wrote] ${result.indexPath}`);
        console.log(`Totals: ${result.totalErrors} errors · ${result.totalWarnings} warnings across ${result.projects.length} projects (${failed} failed).`);
      }
    }
  )
  .command(
    'list-projects',
    'List Nx projects that build-many would target after applying include/exclude filters.',
    (y) =>
      y
        .option('workspace', { type: 'string', describe: 'Workspace root (defaults to cwd).' })
        .option('include', { type: 'array', string: true, default: [] as readonly string[], describe: 'Substring or *-glob filter to keep projects. Repeatable.' })
        .option('exclude', { type: 'array', string: true, default: [] as readonly string[], describe: 'Substring or *-glob filter to drop projects. Repeatable.' })
        .option('all', { type: 'boolean', default: false, describe: 'Include projects that do not declare a lint target.' }),
    (args) => {
      const workspaceRoot = resolveWorkspaceRoot(args);
      const include = (args.include ?? []) as readonly string[];
      const exclude = (args.exclude ?? []) as readonly string[];
      const projects = listProjects(workspaceRoot);
      const lintable = args.all ? projects : projects.filter((p) => p.hasLintTarget);
      const filtered = filterProjects(lintable, include, exclude);
      for (const p of filtered) {
        const lintFlag = p.hasLintTarget ? '' : '  (no lint target)';
        console.log(`${p.name}\t${p.projectRoot}${lintFlag}`);
      }
      console.log(`# ${filtered.length} project(s) (of ${lintable.length} lintable, ${projects.length} total)`);
    }
  )
  .demandCommand(1, 'Specify a command (build, build-many, query, list-projects).')
  .strict()
  .help()
  .alias('h', 'help')
  .parseAsync()
  .catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    process.exit(1);
  });

function resolveWorkspaceRoot(args: CommonArgs): string {
  return resolve(args.workspace ?? process.cwd());
}

function printProgress(event: BuildManyProgressEvent): void {
  const tag = `[${event.index}/${event.total}]`;
  switch (event.kind) {
    case 'start':
      console.log(`${tag} ${event.project} ...`);
      break;
    case 'done':
      console.log(`${tag} ${event.project} → ${event.cache.errorCount} err / ${event.cache.warningCount} warn (${event.cache.filesWithIssues}/${event.cache.fileCount} files)`);
      break;
    case 'error':
      console.error(`${tag} ${event.project} FAILED: ${event.error}`);
      break;
  }
}
