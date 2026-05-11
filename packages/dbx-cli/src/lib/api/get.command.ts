import type { Argv, CommandModule } from 'yargs';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { outputError, outputResult } from '../util/output';
import { parseGetArgs } from './get-args.helper';

/**
 * Top-level `get <modelOrKey> [key]` command.
 *
 * Reads a single Firestore document via the typed model-access endpoint. The `model` arg is optional:
 * when only one positional is supplied, the CLI resolves the modelType from the key's leading
 * collection-name prefix via {@link decodeFirestoreModelKey}. The two-positional form passes the
 * explicit `modelType` straight through.
 *
 * Backend: `GET <apiBaseUrl>/model/<modelType>/get?key=<key>` (ModelApiController.getOne).
 */
export const getCommand: CommandModule = {
  command: 'get <modelOrKey> [key]',
  describe: 'Read a document by key. ModelType is inferred from the key prefix when only one positional is supplied.',
  builder: (yargs: Argv) =>
    yargs
      .positional('modelOrKey', {
        type: 'string',
        describe: 'Full key (e.g. "jws/abc123") or model name when a second positional is supplied.'
      })
      .positional('key', {
        type: 'string',
        describe: 'Document key when the first positional is a model name.'
      }),
  handler: async (argv: any) => {
    try {
      const context: CliContext = requireCliContext();
      const { modelType, key } = parseGetArgs({
        modelOrKey: typeof argv.modelOrKey === 'string' ? argv.modelOrKey : undefined,
        key: typeof argv.key === 'string' ? argv.key : undefined,
        manifest: context.modelManifest
      });
      const result = await context.getModel(modelType, key);
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};
