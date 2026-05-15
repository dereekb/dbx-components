import type { Argv, CommandModule } from 'yargs';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { isStdinSentinel, readStdinTokens } from '../util/stdin';
import { parseGetManyArgs } from './get-args.helper';

/**
 * Top-level `get-many <firstArg> [rest..]` command.
 *
 * Batch-reads Firestore documents by key. The first positional can either be an explicit
 * modelType (followed by ≥1 keys) or a full key (followed by additional keys whose prefixes
 * must resolve to the same modelType). Beyond 50 keys the request is automatically chunked
 * via `context.getMultipleModels`.
 *
 * Stdin: pass `-` as the only positional to read whitespace-separated keys from stdin
 * (e.g. `cat keys.txt | <cli> get-many -`).
 *
 * Backend: `POST <apiBaseUrl>/model/<modelType>/get` with body `{ keys }` (ModelApiController.getMany).
 */
export const getManyCommand: CommandModule = {
  command: 'get-many <firstArg> [rest..]',
  describe: 'Read documents by key (auto-chunks beyond 50). Pass `-` to read keys from stdin.',
  builder: (yargs: Argv) =>
    yargs
      .positional('firstArg', {
        type: 'string',
        describe: 'Full key (e.g. "jws/abc"), model name, or "-" to read keys from stdin.'
      })
      .positional('rest', {
        type: 'string',
        array: true,
        default: [] as string[],
        describe: 'Additional keys (or bare ids when the first positional is a model name).'
      }),
  handler: wrapCommandHandler(async (argv: any) => {
    const context: CliContext = requireCliContext();
    const firstArg = typeof argv.firstArg === 'string' ? argv.firstArg : undefined;
    const rest = Array.isArray(argv.rest) ? (argv.rest as string[]) : [];

    let resolvedFirst = firstArg;
    let resolvedRest = rest;

    if (firstArg && isStdinSentinel(firstArg)) {
      const stdinKeys = await readStdinTokens();
      resolvedFirst = stdinKeys[0];
      resolvedRest = stdinKeys.slice(1);
    }

    const { modelType, keys } = parseGetManyArgs({
      firstArg: resolvedFirst,
      rest: resolvedRest,
      manifest: context.modelManifest
    });
    const result = await context.getMultipleModels(modelType, keys);
    outputResult(result);
  })
};
