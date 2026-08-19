import type { Argv, CommandModule } from 'yargs';
import { type CliContext, requireCliContext } from '../context/cli.context';
import { CLI_READ_VIA_VALUES, DEFAULT_CLI_READ_VIA, cliReadResultMeta, coerceCliReadVia, getModelOverFirestore, resolveCliReadSource } from '../firestore/firestore.read';
import { outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';
import { parseGetArgs } from './get-args.helper';

/**
 * Epilogue shared by the routed read commands, documenting what `--via` does and does not do.
 */
export const CLI_READ_VIA_EPILOGUE = [
  '--via selects the transport:',
  '  auto       (default) go direct to Firestore when a session is available, else the model API',
  '  firestore  direct only — errors rather than falling back',
  '  api        the model API only',
  '',
  'Under `auto` the fallback to the API fires only on a CAPABILITY failure (no firebase config, not',
  'an admin, no session module). A per-document `permission-denied` from the rules is a real answer',
  'about that document and is never retried on the API. `meta.source` reports which path ran.',
  '',
  'A `@dbxModelServerOnly` model is refused on EVERY --via value, before a transport is chosen: it',
  'has no client read grant in `firestore.rules`, so neither path may return it.'
].join('\n');

/**
 * Registers the shared `--via` option on a read command's builder.
 *
 * @param yargs - The command's yargs instance.
 * @returns The instance with `--via` registered and the epilogue attached.
 */
function withViaOption(yargs: Argv): Argv {
  return yargs
    .option('via', {
      type: 'string',
      choices: CLI_READ_VIA_VALUES as unknown as string[],
      default: DEFAULT_CLI_READ_VIA,
      describe: 'Read transport: auto (default), firestore, or api.'
    })
    .epilogue(CLI_READ_VIA_EPILOGUE);
}

/**
 * Top-level `get <modelOrKey> [key]` command.
 *
 * Reads a single Firestore document. The `model` arg is optional: when only one positional is
 * supplied, the CLI resolves the modelType from the key's leading collection-name prefix via
 * {@link decodeFirestoreModelKey}. The two-positional form passes the explicit `modelType` straight
 * through.
 *
 * Transport is chosen by `--via` (see {@link CLI_READ_VIA_EPILOGUE}). Both paths emit the identical
 * `{ key, data }` envelope, so `--via` is observable only through `meta.source`.
 *
 * Backends: `GET <apiBaseUrl>/model/<modelType>/get?key=<key>` (ModelApiController.getOne), or a
 * direct Firestore read through the app's security rules as the authenticated user.
 */
export const GET_COMMAND: CommandModule = {
  command: 'get <modelOrKey> [key]',
  describe: 'Read a document by key. ModelType is inferred from the key prefix when only one positional is supplied.',
  builder: (yargs: Argv) =>
    withViaOption(
      yargs
        .positional('modelOrKey', {
          type: 'string',
          describe: 'Full key (e.g. "jws/abc123") or model name when a second positional is supplied.'
        })
        .positional('key', {
          type: 'string',
          describe: 'Document key when the first positional is a model name.'
        })
    ),
  handler: wrapCommandHandler(async (argv: any) => {
    const context: CliContext = requireCliContext();
    const { modelType, key } = parseGetArgs({
      modelOrKey: typeof argv.modelOrKey === 'string' ? argv.modelOrKey : undefined,
      key: typeof argv.key === 'string' ? argv.key : undefined,
      manifest: context.modelManifest
    });

    const resolved = await resolveCliReadSource({ context, via: coerceCliReadVia(argv.via), modelType });
    const result = resolved.models ? await getModelOverFirestore({ models: resolved.models, modelType, key }) : await context.getModel(modelType, key);

    outputResult(result, cliReadResultMeta(resolved));
  })
};
