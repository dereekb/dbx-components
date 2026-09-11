import { type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { type CliDataCache, cliDataCacheMeta, createCliDataCache, loadOrBuildCliCachedData } from '../cache/data-cache';
import { DISABLED_CLI_DATA_CACHE_OPTIONS, cliDataCacheOptions } from '../cache/data-cache.options';
import { buildCliPaths } from '../config/paths';
import { requireCliContext } from '../context/cli.context';
import { type CliFirestoreQueryManifest } from '../manifest/types';
import { wrapCommandHandler } from '../util/handler';
import { outputResult } from '../util/output';
import { requireCliFirestoreModels } from './firestore.models';
import { type CliFirestoreQueryResult, runCliFirestoreQuery } from './firestore.query';
import { resolveCliFirestoreQueryArgs } from './firestore.query-params';
import { resolveCliFirestoreQueryEntry } from './query-info-utils';
import { assertCliFirestoreQueryCanRun } from './query-mode';
import { createCliFirestoreQueryRegistry } from './query-registry';

/**
 * Default command name for the Firestore query execution command.
 */
export const DEFAULT_FIRESTORE_QUERY_COMMAND_NAME = 'firestore-query';

/**
 * Dataset id prefix under which a `firestore-query` run records its result.
 *
 * One dataset per catalog slug, so `cache list` reads as a list of queries rather than one
 * undifferentiated blob.
 */
export const CLI_FIRESTORE_QUERY_DATASET_PREFIX = 'firestore-query';

/**
 * Version of the recorded `firestore-query` payload.
 *
 * Bump when the result envelope's shape changes, or when the row projection changes what it decodes
 * — a recorded build from older code is a wrong-answer bug, not just a slow one.
 */
export const CLI_FIRESTORE_QUERY_DATASET_VERSION = 1;

/**
 * Options accepted by {@link buildFirestoreQueryCommand}.
 */
export interface BuildFirestoreQueryCommandOptions {
  readonly commandName?: string;
  /**
   * The dataset cache recorded runs are written to and `--cache` reads from.
   *
   * Supplied by `createCli` so the `cache` command group and this command share ONE instance (and
   * so a test can point both at a temp directory). Omitted, it falls back to the CLI's own
   * `<configDir>/cache`.
   */
  readonly dataCache?: Maybe<CliDataCache>;
}

const EPILOGUE = [
  'Parameters are positional-first:',
  "  --params '[true]'            spread positionally — works for every factory shape",
  '  --params \'{"published":true}\'  for a single-params-object factory, passed as arg 0;',
  '                                otherwise mapped by parameter name into positional order',
  '  (omitted)                    valid only when every parameter is optional',
  '',
  'Dates are coerced from strings: at the top level whenever the parameter type mentions `Date`,',
  'and inside an object parameter only for strict ISO-8601 datetimes carrying a time AND a zone —',
  'a bare YYYY-MM-DD is left alone, because `firestoreDate` persists an ISO string and coercing one',
  'would silently break an equality match. `--raw-params` disables all coercion.',
  '',
  "A query `firestore-queries` reports as MODE = parent-child addresses ONE parent document's",
  'subcollection: pass --parent with the full ancestor chain the rules declare (any depth).',
  'MODE = unavailable means no client can run it on any transport.',
  '',
  'With the dataset cache enabled, every run RECORDS its rows and `--cache` reads them back. The',
  'recorded build is keyed by the RESOLVED parameters, so two spellings of the same params object',
  'share one entry. `cache list` shows what has been recorded.'
].join('\n');

/**
 * Builds the top-level `firestore-query <query>` command.
 *
 * Executes a catalog entry over the direct Firestore connection, through the app's security rules
 * as the authenticated user.
 *
 * @param manifest - The generated Firestore query manifest.
 * @param options - Optional command-name override and the shared dataset cache.
 * @returns A yargs `CommandModule` for `runCli({ apiCommands })`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFirestoreQueryCommand(manifest: CliFirestoreQueryManifest, options?: BuildFirestoreQueryCommandOptions): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_FIRESTORE_QUERY_COMMAND_NAME;
  const registry = createCliFirestoreQueryRegistry(manifest);

  return {
    command: `${commandName} <query>`,
    describe: 'Run a catalogued Firestore query over a DIRECT Firestore connection (through security rules).',
    builder: (yargs: Argv) =>
      yargs
        .positional('query', { type: 'string', describe: 'Slug or exported identifier of the query to run. See `firestore-queries`.' })
        .option('params', { type: 'string', describe: 'JSON array (positional) or object (by name / single params object) of factory arguments.' })
        .option('raw-params', { type: 'boolean', default: false, describe: 'Disable date coercion on --params.' })
        .option('parent', { type: 'string', describe: 'Parent DOCUMENT key to scope a nested model to — any depth (e.g. "gb/abc", "jl/abc/jlj/def").' })
        .option('limit', { type: 'number', describe: "Replace the query's limit with this value." })
        .option('count', { type: 'boolean', default: false, describe: 'Return only the matching count, with no rows.' })
        .epilogue(EPILOGUE),
    handler: wrapCommandHandler(async (argv: any) => {
      const entry = resolveCliFirestoreQueryEntry(registry, String(argv.query));
      const parent = typeof argv.parent === 'string' ? argv.parent : undefined;
      const params = typeof argv.params === 'string' ? argv.params : undefined;
      const rawParams = Boolean(argv.rawParams);
      const limit = typeof argv.limit === 'number' ? argv.limit : undefined;
      const count = Boolean(argv.count);

      // refused before the session is opened, mirroring `firestore-get`'s server-only check: the
      // mode is a property of the entry, so paying for a handshake to be told `permission-denied`
      // teaches nothing. `runCliFirestoreQuery` re-checks for programmatic callers.
      assertCliFirestoreQueryCanRun({ entry, parent });

      const context = requireCliContext();
      // no cache supplied means the CLI did not enable one, and the whole path goes inert: with
      // reads and writes both off, `loadOrBuildCliCachedData` never touches disk, so a CLI without
      // `runCli({ dataCache })` neither records anything nor grows a cache directory
      const dataCache = options?.dataCache;
      const cache = dataCache ?? createCliDataCache({ dataCacheDir: buildCliPaths({ cliName: context.cliName }).dataCacheDir });
      const cacheOptions = dataCache == null ? DISABLED_CLI_DATA_CACHE_OPTIONS : cliDataCacheOptions();
      let sessionFromCache: Maybe<boolean>;

      const cached = await loadOrBuildCliCachedData<CliFirestoreQueryResult>({
        cache,
        dataset: `${CLI_FIRESTORE_QUERY_DATASET_PREFIX}:${entry.slug}`,
        datasetVersion: CLI_FIRESTORE_QUERY_DATASET_VERSION,
        env: context.envName,
        // the RESOLVED args rather than the raw `--params` string, so `{"a":1,"b":2}` and
        // `{"b":2,"a":1}` are one recorded build instead of two. `rawParams` is folded in by virtue
        // of changing what the args resolve to.
        filter: { args: resolveCliFirestoreQueryArgs({ entry, params, rawParams }), parent, limit, count },
        options: cacheOptions,
        // the session is opened INSIDE the build, so a cache hit costs no handshake at all
        build: async () => {
          const models = await requireCliFirestoreModels(context);
          sessionFromCache = models.session.fromCache;
          return runCliFirestoreQuery({ models, entry, params, rawParams, parent, limit, count });
        }
      });

      outputResult(cached.data, {
        source: cached.fromCache ? 'cache' : 'firestore',
        ...(sessionFromCache === undefined ? {} : { sessionFromCache }),
        // omitted entirely when no cache is configured, so an envelope never advertises provenance
        // for a cache that does not exist
        ...(dataCache == null ? {} : cliDataCacheMeta(cached))
      });
    })
  };
}
