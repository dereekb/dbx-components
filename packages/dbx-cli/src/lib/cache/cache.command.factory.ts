import { MS_IN_HOUR, type Hours, type Maybe, type Milliseconds, noop } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { buildCliPaths } from '../config/paths';
import { CliError, outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { renderTable, truncate } from '../util/table';
import { type CliDataCache, type CliDataCacheEntry, createCliDataCache } from './data-cache';
import { canonicalCliCacheJson } from './data-cache.fingerprint';

/**
 * Default command name for the data-cache management command.
 */
export const DEFAULT_CLI_DATA_CACHE_COMMAND_NAME = 'cache';

export interface CreateCacheCommandInput {
  readonly cliName: string;
  /**
   * Override for the cache the command manages. Defaults to the CLI's own
   * `<configDir>/cache` directory.
   */
  readonly cache?: Maybe<CliDataCache>;
  /**
   * The current CLI build stamp. When supplied, `cache list` marks entries recorded by a different
   * build, which is the one staleness signal the fingerprint deliberately does not cover.
   */
  readonly cliBuildStamp?: Maybe<string>;
  readonly commandName?: string;
}

/**
 * Renders a byte count compactly.
 *
 * @param bytes - The size in bytes.
 * @returns A short human rendering, e.g. `1.4M`.
 *
 * @__NO_SIDE_EFFECTS__
 */
function renderBytes(bytes: number): string {
  const units = ['B', 'K', 'M', 'G'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value = value / 1024;
    unitIndex += 1;
  }

  return `${unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)}${units[unitIndex]}`;
}

/**
 * Renders an age compactly.
 *
 * @param ageMs - The age in milliseconds.
 * @returns A short human rendering, e.g. `3h`, `2d`, or `?` when the age is unknown.
 *
 * @__NO_SIDE_EFFECTS__
 */
function renderAge(ageMs: Maybe<Milliseconds>): string {
  let result: string;

  if (ageMs == null || !Number.isFinite(ageMs)) {
    result = '?';
  } else {
    const hours = ageMs / MS_IN_HOUR;
    result = hours < 1 ? `${Math.max(1, Math.round(ageMs / 60_000))}m` : hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`;
  }
  return result;
}

/**
 * The age of a recorded build, or `undefined` when its timestamp is unparsable.
 *
 * @param entry - The entry to measure.
 * @returns The age in milliseconds.
 *
 * @__NO_SIDE_EFFECTS__
 */
function entryAgeMs(entry: CliDataCacheEntry): Maybe<Milliseconds> {
  const builtAtMs = Date.parse(entry.builtAt);
  return Number.isFinite(builtAtMs) ? Math.max(0, Date.now() - builtAtMs) : undefined;
}

/**
 * Renders the entry list as a column-aligned table.
 *
 * @param entries - The entries to render, already ordered.
 * @param cliBuildStamp - The current build stamp, for marking entries from another build.
 * @returns The table, with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
function renderCliDataCacheEntryList(entries: readonly CliDataCacheEntry[], cliBuildStamp: Maybe<string>): string {
  let result: string;

  if (entries.length === 0) {
    result = 'No recorded dataset builds.\n';
  } else {
    const rows: string[][] = [['DATASET', 'ENV', 'AGE', 'ROWS', 'SIZE', 'FINGERPRINT', 'FILTER']];

    for (const entry of entries) {
      const otherBuild = cliBuildStamp != null && entry.cliBuildStamp != null && entry.cliBuildStamp !== cliBuildStamp;
      rows.push([entry.dataset, entry.env, `${renderAge(entryAgeMs(entry))}${otherBuild ? '*' : ''}`, entry.itemCount == null ? '-' : String(entry.itemCount), renderBytes(entry.bytes), entry.fingerprint, truncate(canonicalCliCacheJson(entry.filter), 60)]);
    }

    const footnote = cliBuildStamp != null && entries.some((entry) => entry.cliBuildStamp != null && entry.cliBuildStamp !== cliBuildStamp) ? '\n\n* recorded by a different CLI build.' : '';
    result = `${renderTable(rows)}${footnote}\n`;
  }

  return result;
}

/**
 * Factory for the `cache` command.
 *
 * Registered as a CONFIG command, not an API command: inspecting or clearing a LOCAL cache must work
 * offline and without a token — which is precisely the situation in which a cache matters. Mirrors
 * the `firestore-queries` (config) vs `firestore-query` (api) split.
 *
 * Subcommands:
 * - `cache list [--env <env>] [--dataset <id>] [--json]`
 * - `cache show <dataset> [--env <env>] [--fingerprint <fp>] [--data]`
 * - `cache clear [--env <env>] [--dataset <id>] [--all]`
 * - `cache prune --older-than <hours> [--env <env>] [--dataset <id>]`
 *
 * @param input - Factory configuration.
 * @param input.cliName - The CLI's binary name, used to derive the default cache directory.
 * @param input.cache - Optional cache override (tests point this at a temp dir).
 * @param input.cliBuildStamp - The current build stamp, for marking entries from another build.
 * @param input.commandName - Optional command-name override.
 * @returns A yargs `CommandModule` for `runCli({ configCommands })`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createCacheCommand(input: CreateCacheCommandInput): CommandModule {
  const commandName = input.commandName ?? DEFAULT_CLI_DATA_CACHE_COMMAND_NAME;
  const cliBuildStamp = input.cliBuildStamp;
  const cache = input.cache ?? createCliDataCache({ dataCacheDir: buildCliPaths({ cliName: input.cliName }).dataCacheDir, ...(cliBuildStamp == null ? {} : { cliBuildStamp }) });

  const listCommand: CommandModule = {
    command: 'list',
    describe: 'List recorded dataset builds, newest first.',
    builder: (yargs: Argv) =>
      yargs
        .option('env', { type: 'string', describe: 'Only entries recorded against this env.' })
        .option('dataset', { type: 'string', describe: 'Only entries for this dataset id (e.g. worker.lineDetails).' })
        .option('json', { type: 'boolean', default: false, describe: 'Emit a structured JSON envelope instead of the table.' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const entries = await cache.listEntries({ env: argv.env, dataset: argv.dataset });

      if (argv.json) {
        outputResult(entries.map((entry) => ({ ...entry, ageMs: entryAgeMs(entry) })));
      } else {
        process.stdout.write(renderCliDataCacheEntryList(entries, cliBuildStamp));
      }
    })
  };

  const showCommand: CommandModule = {
    command: 'show <dataset>',
    describe: 'Show one recorded build in detail.',
    builder: (yargs: Argv) =>
      yargs
        .positional('dataset', { type: 'string', describe: 'The dataset id to show.' })
        .option('env', { type: 'string', describe: 'Disambiguate when the dataset was recorded against several envs.' })
        .option('fingerprint', { type: 'string', describe: 'Disambiguate when several filters were recorded for the dataset.' })
        .option('data', { type: 'boolean', default: false, describe: 'Include the cached payload. Pair with --pick / --dump-dir for a large one.' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const entries = await cache.listEntries({ env: argv.env, dataset: String(argv.dataset), fingerprint: argv.fingerprint });
      const entry = entries[0];

      if (entry == null) {
        throw new CliError({
          message: `No recorded build for dataset "${argv.dataset}".`,
          code: 'CLI_DATA_CACHE_ENTRY_NOT_FOUND',
          suggestion: `Run \`${input.cliName} ${commandName} list\` to see what has been recorded.`
        });
      }

      const meta = { ...entry, ageMs: entryAgeMs(entry), otherMatches: entries.length - 1 };

      if (argv.data) {
        const hit = await cache.loadData<unknown>({ dataset: entry.dataset, datasetVersion: entry.datasetVersion, env: entry.env, filter: entry.filter });
        outputResult({ ...meta, data: hit?.data });
      } else {
        outputResult(meta);
      }
    })
  };

  const clearCommand: CommandModule = {
    command: 'clear',
    describe: 'Remove recorded builds.',
    builder: (yargs: Argv) =>
      yargs
        .option('env', { type: 'string', describe: 'Only entries recorded against this env.' })
        .option('dataset', { type: 'string', describe: 'Only entries for this dataset id.' })
        .option('all', { type: 'boolean', default: false, describe: 'Required to clear the whole cache with no narrowing.' })
        .check((argv) => {
          // an unnarrowed `cache clear` almost always means "clear the one I was just looking at",
          // and re-downloading every dataset is the expensive mistake this feature exists to avoid
          if (!argv['all'] && argv['env'] == null && argv['dataset'] == null) {
            throw new Error('Pass --env and/or --dataset to narrow the clear, or --all to remove every recorded build.');
          }

          return true;
        }),
    handler: wrapCommandHandler(async (argv: any) => {
      const removed = await cache.removeEntries({ env: argv.env, dataset: argv.dataset });
      outputResult({ cleared: removed.length, entries: removed.map((entry) => ({ dataset: entry.dataset, env: entry.env, fingerprint: entry.fingerprint })) });
    })
  };

  const pruneCommand: CommandModule = {
    command: 'prune',
    describe: 'Remove recorded builds older than a given age.',
    builder: (yargs: Argv) =>
      yargs.option('older-than', { type: 'number', demandOption: true, describe: 'Remove entries built more than this many hours ago.' }).option('env', { type: 'string', describe: 'Only entries recorded against this env.' }).option('dataset', { type: 'string', describe: 'Only entries for this dataset id.' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const olderThanHours: Hours = Number(argv.olderThan);
      const removed = await cache.removeEntries({ env: argv.env, dataset: argv.dataset, olderThanMs: olderThanHours * MS_IN_HOUR });
      outputResult({ pruned: removed.length, olderThanHours, entries: removed.map((entry) => ({ dataset: entry.dataset, env: entry.env, fingerprint: entry.fingerprint, builtAt: entry.builtAt })) });
    })
  };

  return {
    command: commandName,
    describe: 'Inspect and clear the local dataset cache (recorded query/export builds).',
    builder: (yargs: Argv) => yargs.command(listCommand).command(showCommand).command(clearCommand).command(pruneCommand).demandCommand(1, 'Specify a cache subcommand.'),
    handler: noop
  };
}
