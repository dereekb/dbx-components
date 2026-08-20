import type { Argv, CommandModule } from 'yargs';
import { parseGetArgs } from '../api/get-args.helper';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { wrapCommandHandler } from '../util/handler';
import { outputResult } from '../util/output';
import { requireCliFirestoreModels } from './firestore.models';
import { assertCliModelIsNotServerOnly, getModelOverFirestore } from './firestore.read';

/**
 * Default command name for the direct-Firestore single-document read.
 */
export const DEFAULT_FIRESTORE_GET_COMMAND_NAME = 'firestore-get';

/**
 * Options accepted by {@link buildFirestoreGetCommand}.
 */
export interface BuildFirestoreGetCommandOptions {
  readonly commandName?: string;
}

/**
 * Builds the top-level `firestore-get <modelOrKey> [key]` command.
 *
 * Reads one document over the direct Firestore connection, through security rules. Positional
 * parsing goes through the same {@link parseGetArgs} the API-backed `get` uses, so inferred-model
 * resolution behaves identically, and the emitted `{ key, data }` is byte-identical to
 * `GetModelOverHttpResult`.
 *
 * There is no `--via` here — the command name IS the transport selection. `get --via firestore` is
 * the routed equivalent for callers that want a fallback.
 *
 * @param options - Optional command-name override.
 * @returns A yargs `CommandModule` for `runCli({ apiCommands })`.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildFirestoreGetCommand(options?: BuildFirestoreGetCommandOptions): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_FIRESTORE_GET_COMMAND_NAME;

  return {
    command: `${commandName} <modelOrKey> [key]`,
    describe: 'Read a document by key over a DIRECT Firestore connection (through security rules).',
    builder: (yargs: Argv) => yargs.positional('modelOrKey', { type: 'string', describe: 'Full key (e.g. "gb/abc123") or model name when a second positional is supplied.' }).positional('key', { type: 'string', describe: 'Document key when the first positional is a model name.' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const context: CliContext = requireCliContext();
      const { modelType, key } = parseGetArgs({
        modelOrKey: typeof argv.modelOrKey === 'string' ? argv.modelOrKey : undefined,
        key: typeof argv.key === 'string' ? argv.key : undefined,
        manifest: context.modelManifest
      });

      // refused before the session is opened: a server-only model has no client read grant in the
      // rules either, so paying for a handshake to be told `permission-denied` teaches nothing
      assertCliModelIsNotServerOnly({ manifest: context.modelManifest, modelType });

      const models = await requireCliFirestoreModels(context);
      const result = await getModelOverFirestore({ models, modelType, key });
      outputResult(result, { source: 'firestore', sessionFromCache: models.session.fromCache });
    })
  };
}
