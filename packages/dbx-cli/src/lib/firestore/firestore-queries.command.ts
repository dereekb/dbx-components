import type { Argv, CommandModule } from 'yargs';
import { type CliFirestoreQueryManifest } from '../manifest/types';
import { wrapSyncCommandHandler } from '../util/handler';
import { outputResult } from '../util/output';
import { filterCliFirestoreQueries, renderCliFirestoreQueryEntry, renderCliFirestoreQueryList, resolveCliFirestoreQueryEntry } from './query-info-utils';
import { createCliFirestoreQueryRegistry } from './query-registry';

/**
 * Default command name for the Firestore query catalog command.
 */
export const DEFAULT_FIRESTORE_QUERIES_COMMAND_NAME = 'firestore-queries';

/**
 * Options accepted by {@link buildFirestoreQueriesCommand}.
 */
export interface BuildFirestoreQueriesCommandOptions {
  readonly commandName?: string;
}

/**
 * Builds the top-level `firestore-queries [query]` catalog command.
 *
 * Registered as a CONFIG command, not an API command — browsing the catalog is a documentation
 * read, and demanding a login to see what queries exist would be the wrong trade. This mirrors the
 * existing `model-info` (config, auth-bypassed) vs `model <m> get` (api, post-auth) split.
 *
 * @param manifest - The generated Firestore query manifest.
 * @param options - Optional command-name override.
 * @returns A yargs `CommandModule` for `runCli({ configCommands })`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFirestoreQueriesCommand(manifest: CliFirestoreQueryManifest, options?: BuildFirestoreQueriesCommandOptions): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_FIRESTORE_QUERIES_COMMAND_NAME;
  const registry = createCliFirestoreQueryRegistry(manifest);

  return {
    command: `${commandName} [query]`,
    describe: `List the Firestore queries this CLI can run directly (${registry.all.length} quer${registry.all.length === 1 ? 'y' : 'ies'}).`,
    builder: (yargs: Argv) =>
      yargs
        .positional('query', { type: 'string', describe: 'Slug or exported identifier to show in detail. Omit to list every query.' })
        .option('model', { type: 'string', describe: 'Filter to one model (PascalCase name or collection prefix).' })
        .option('category', { type: 'string', describe: 'Filter to one @dbxModelFirebaseIndexCategory.' })
        .option('tag', { type: 'string', describe: 'Filter to entries carrying this tag.' })
        .option('json', { type: 'boolean', default: false, describe: 'Emit a structured JSON envelope instead of the human-readable table.' }),
    handler: wrapSyncCommandHandler((argv: any) => {
      const query = typeof argv.query === 'string' && argv.query.length > 0 ? argv.query : undefined;

      if (query) {
        const entry = resolveCliFirestoreQueryEntry(registry, query);

        if (argv.json) {
          outputResult(toJsonEntry(entry));
        } else {
          process.stdout.write(renderCliFirestoreQueryEntry(entry));
        }
      } else {
        const entries = filterCliFirestoreQueries(registry, { model: argv.model, category: argv.category, tag: argv.tag });

        if (argv.json) {
          outputResult(entries.map(toJsonEntry));
        } else {
          process.stdout.write(renderCliFirestoreQueryList(entries));
        }
      }
    })
  };
}

/**
 * Strips the bound `factory` (a live function, not serializable) and replaces it with the
 * `invocable` boolean the JSON consumer actually wants.
 *
 * @param entry - The catalog entry to serialize.
 * @returns The entry with `factory` swapped for `invocable`.
 */
function toJsonEntry(entry: CliFirestoreQueryManifest[number]): Record<string, unknown> {
  const { factory, ...rest } = entry;
  return { ...rest, invocable: factory != null };
}
