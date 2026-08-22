import type { Argv, CommandModule } from 'yargs';
import { requireCliContext } from '../context/cli.context';
import { type CliFirestoreQueryManifest } from '../manifest/types';
import { wrapCommandHandler } from '../util/handler';
import { outputResult } from '../util/output';
import { requireCliFirestoreModels } from './firestore.models';
import { runCliFirestoreQuery } from './firestore.query';
import { resolveCliFirestoreQueryEntry } from './query-info-utils';
import { assertCliFirestoreQueryCanRun } from './query-mode';
import { createCliFirestoreQueryRegistry } from './query-registry';

/**
 * Default command name for the Firestore query execution command.
 */
export const DEFAULT_FIRESTORE_QUERY_COMMAND_NAME = 'firestore-query';

/**
 * Options accepted by {@link buildFirestoreQueryCommand}.
 */
export interface BuildFirestoreQueryCommandOptions {
  readonly commandName?: string;
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
  'MODE = unavailable means no client can run it on any transport.'
].join('\n');

/**
 * Builds the top-level `firestore-query <query>` command.
 *
 * Executes a catalog entry over the direct Firestore connection, through the app's security rules
 * as the authenticated user.
 *
 * @param manifest - The generated Firestore query manifest.
 * @param options - Optional command-name override.
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

      // refused before the session is opened, mirroring `firestore-get`'s server-only check: the
      // mode is a property of the entry, so paying for a handshake to be told `permission-denied`
      // teaches nothing. `runCliFirestoreQuery` re-checks for programmatic callers.
      assertCliFirestoreQueryCanRun({ entry, parent });

      const models = await requireCliFirestoreModels(requireCliContext());

      const result = await runCliFirestoreQuery({
        models,
        entry,
        params: typeof argv.params === 'string' ? argv.params : undefined,
        rawParams: Boolean(argv.rawParams),
        parent,
        limit: typeof argv.limit === 'number' ? argv.limit : undefined,
        count: Boolean(argv.count)
      });

      outputResult(result, { source: 'firestore', sessionFromCache: models.session.fromCache });
    })
  };
}
