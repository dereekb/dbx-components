import type { Argv, CommandModule } from 'yargs';
import { CliError, outputResult } from '../util/output';
import { wrapSyncCommandHandler } from '../util/handler';
import { renderModelManifestEntry, renderModelManifestFields, renderModelManifestList, resolveCliModel } from './model-info-utils';
import type { CliModelManifest } from './types';

/**
 * Default command name for the model-info command. Top-level so it stays out
 * of the API-call namespace owned by `model <model> <action>`.
 */
export const DEFAULT_MODEL_INFO_COMMAND_NAME = 'model-info';

/**
 * Options accepted by {@link buildModelInfoCommand}.
 */
export interface BuildModelInfoCommandOptions {
  /**
   * Override the parent command name. Defaults to
   * {@link DEFAULT_MODEL_INFO_COMMAND_NAME}.
   */
  readonly commandName?: string;
}

/**
 * Builds the top-level `model-info [model]` command.
 *
 * Without an argument: prints a column-aligned table summarising every model
 * in the manifest. With an argument: looks the model up by `modelType`,
 * `identityConst`, or `collectionPrefix` and prints its full per-field
 * documentation, recursing into nested converters when the manifest captured
 * them.
 *
 * Flags:
 *   - `--json` emits a structured `{ ok, data }` envelope instead of the
 *     human-readable table (useful for scripting or LLM agents).
 *   - `--fields` prints only the field table for the resolved model.
 *
 * @param manifest - The generated model manifest (e.g. `DEMO_CLI_MODEL_MANIFEST`).
 * @param options - Optional overrides; see {@link BuildModelInfoCommandOptions}.
 * @returns A yargs `CommandModule` ready to be passed to `runCli({ configCommands })`.
 * @__NO_SIDE_EFFECTS__
 */
export function buildModelInfoCommand(manifest: CliModelManifest, options?: BuildModelInfoCommandOptions): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_MODEL_INFO_COMMAND_NAME;
  return {
    command: `${commandName} [model]`,
    describe: `Show generated catalog and field info for Firestore models (${manifest.length} model${manifest.length === 1 ? '' : 's'}).`,
    builder: (yargs: Argv) => {
      return yargs
        .positional('model', {
          type: 'string',
          describe: 'Model to inspect (modelType, identity const, or collection prefix). Omit to list every model.'
        })
        .option('json', {
          type: 'boolean',
          default: false,
          describe: 'Emit a structured JSON envelope instead of the human-readable table.'
        })
        .option('fields', {
          type: 'boolean',
          default: false,
          describe: 'Print only the field table for the resolved model.'
        });
    },
    handler: wrapSyncCommandHandler((argv: any) => {
      runHandler(manifest, argv);
    })
  };
}

interface ModelInfoArgv {
  readonly model?: string;
  readonly json?: boolean;
  readonly fields?: boolean;
}

function runHandler(manifest: CliModelManifest, argv: ModelInfoArgv): void {
  const query = typeof argv.model === 'string' && argv.model.length > 0 ? argv.model : undefined;

  if (!query) {
    if (argv.json) {
      outputResult(manifest);
    } else {
      process.stdout.write(renderModelManifestList(manifest));
    }
  } else {
    const entry = resolveCliModel(manifest, query);
    if (!entry) {
      throw new CliError({
        message: `No model matches '${query}'. Run \`model-info\` without an argument to list available models.`,
        code: 'MODEL_INFO_NOT_FOUND'
      });
    }

    if (argv.json) {
      outputResult(entry);
    } else if (argv.fields) {
      process.stdout.write(renderModelManifestFields(entry));
    } else {
      process.stdout.write(renderModelManifestEntry(entry));
    }
  }
}
