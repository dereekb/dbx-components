import type { Argv, CommandModule } from 'yargs';
import { type Maybe } from '@dereekb/util';
import { parseGetArgs } from '../api/get-args.helper';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { wrapCommandHandler } from '../util/handler';
import { CliError, outputResult } from '../util/output';
import { requireCliFirestoreModels } from './firestore.models';

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

      const models = await requireCliFirestoreModels(context);
      const result = await getModelOverFirestore({ models, modelType, key });
      outputResult(result, { source: 'firestore' });
    })
  };
}

/**
 * Result of {@link getModelOverFirestore} — the same envelope `GET /model/<type>/get` returns, so
 * the transport is not observable in the output shape.
 */
export interface GetModelOverFirestoreResult<T = unknown> {
  readonly key: string;
  readonly data: Maybe<T>;
}

/**
 * Reads one document directly from Firestore by model key.
 *
 * @param input - The read inputs.
 * @param input.models - The session-bound models view.
 * @param input.modelType - The model type to load through.
 * @param input.key - The document key to read.
 * @returns `{ key, data }`, with `data: null` when the document does not exist.
 * @throws {CliError} When the key does not match the model's path shape.
 */
export async function getModelOverFirestore<T = unknown>(input: { readonly models: Awaited<ReturnType<typeof requireCliFirestoreModels>>; readonly modelType: string; readonly key: string }): Promise<GetModelOverFirestoreResult<T>> {
  const { models, modelType, key } = input;
  const service = models.serviceFor(modelType);
  let data: Maybe<T>;

  try {
    data = ((await service.loadModelForKey(key).snapshotData()) ?? null) as Maybe<T>;
  } catch (e) {
    // `documentRefForKey` throws a bare Error (`unexpected key/path "…" for expected type …`) on a
    // mismatched path, which would otherwise reach the user as a generic ERROR envelope.
    if (e instanceof Error && /unexpected key\/path/i.test(e.message)) {
      throw new CliError({
        message: `Key "${key}" does not match the path shape for model "${modelType}": ${e.message}`,
        code: 'INVALID_ARGUMENT',
        suggestion: 'Nested models need their full parent path, e.g. "gb/<guestbookId>/gbe/<entryId>".'
      });
    }

    throw e;
  }

  return { key, data };
}
