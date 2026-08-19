import type { Argv, CommandModule } from 'yargs';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { CLI_READ_VIA_VALUES, DEFAULT_CLI_READ_VIA, cliReadResultMeta, coerceCliReadVia, getMultipleModelsOverFirestore, resolveCliReadSource } from '../firestore/firestore.read';
import { outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { isStdinSentinel, readStdinTokens } from '../util/stdin';
import { CLI_READ_VIA_EPILOGUE } from './get.command';
import { parseGetManyArgs } from './get-args.helper';

/**
 * Top-level `get-many <firstArg> [rest..]` command.
 *
 * Batch-reads Firestore documents by key. The first positional can either be an explicit
 * modelType (followed by ≥1 keys) or a full key (followed by additional keys whose prefixes
 * must resolve to the same modelType). Beyond 50 keys the API request is automatically chunked
 * via `context.getMultipleModels`; the direct path has no per-request cap and issues the reads
 * concurrently.
 *
 * Stdin: pass `-` as the only positional to read whitespace-separated keys from stdin
 * (e.g. `cat keys.txt | <cli> get-many -`).
 *
 * Transport is chosen by `--via` (see {@link CLI_READ_VIA_EPILOGUE}). Both paths emit the identical
 * `{ results, errors }` envelope, so `--via` is observable only through `meta.source`.
 *
 * Backends: `POST <apiBaseUrl>/model/<modelType>/get` with body `{ keys }`
 * (ModelApiController.getMany), or direct Firestore reads through the app's security rules.
 */
export const GET_MANY_COMMAND: CommandModule = {
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
      })
      .option('via', {
        type: 'string',
        choices: CLI_READ_VIA_VALUES as unknown as string[],
        default: DEFAULT_CLI_READ_VIA,
        describe: 'Read transport: auto (default), firestore, or api.'
      })
      .epilogue(CLI_READ_VIA_EPILOGUE),
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

    const resolved = await resolveCliReadSource({ context, via: coerceCliReadVia(argv.via), modelType });
    const result = resolved.models ? await getMultipleModelsOverFirestore({ models: resolved.models, modelType, keys }) : await context.getMultipleModels(modelType, keys);

    outputResult(result, cliReadResultMeta(resolved));
  })
};
