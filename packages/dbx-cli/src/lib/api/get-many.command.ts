import type { Argv, CommandModule } from 'yargs';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { outputError, outputResult } from '../util/output';
import { parseGetManyArgs } from './get-args.helper';

/**
 * Top-level `get-many <firstArg> [rest..]` command.
 *
 * Batch-reads up to 50 Firestore documents in a single request. The first positional can either
 * be an explicit modelType (followed by ≥1 keys) or a full key (followed by additional keys whose
 * prefixes must resolve to the same modelType).
 *
 * Backend: `POST <apiBaseUrl>/model/<modelType>/get` with body `{ keys }` (ModelApiController.getMany).
 */
export const getManyCommand: CommandModule = {
  command: 'get-many <firstArg> [rest..]',
  describe: 'Read up to 50 documents by key. ModelType is inferred from key prefixes when they all agree.',
  builder: (yargs: Argv) =>
    yargs
      .positional('firstArg', {
        type: 'string',
        describe: 'Full key (e.g. "jws/abc") or model name when the remaining positionals are bare ids.'
      })
      .positional('rest', {
        type: 'string',
        array: true,
        default: [] as string[],
        describe: 'Additional keys (or bare ids when the first positional is a model name).'
      }),
  handler: async (argv: any) => {
    try {
      const context: CliContext = requireCliContext();
      const { modelType, keys } = parseGetManyArgs({
        firstArg: typeof argv.firstArg === 'string' ? argv.firstArg : undefined,
        rest: Array.isArray(argv.rest) ? (argv.rest as string[]) : [],
        manifest: context.modelManifest
      });
      const result = await context.getMultipleModels(modelType, keys);
      outputResult(result);
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};
