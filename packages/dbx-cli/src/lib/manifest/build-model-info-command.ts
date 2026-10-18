import { type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { CliError, outputResult } from '../util/output';
import { wrapSyncCommandHandler } from '../util/handler';
import { findReferencedCliEnums } from './enum-info-utils';
import { renderModelManifestEntry, renderModelManifestFields, renderModelManifestList, resolveCliModel } from './model-info-utils';
import type { CliEnumManifest, CliModelManifest } from './types';

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
  /**
   * Generated enum value tables (`<NAMESPACE>_ENUM_MANIFEST`). When provided, the per-model view
   * ends with the value tables of the enums its fields reference, and `--json` adds them as an
   * `enums` array next to the entry's keys (absent when none resolve).
   */
  readonly enumManifest?: Maybe<CliEnumManifest>;
}

/**
 * Builds the top-level `model-info [model]` command.
 *
 * Without an argument: prints a column-aligned table summarising every model
 * in the manifest. With an argument: looks the model up by `modelType`,
 * `identityConst`, or `collectionPrefix` and prints its full per-field
 * documentation, recursing into nested converters when the manifest captured
 * them. With {@link BuildModelInfoCommandOptions.enumManifest}, the per-model
 * view also carries the value tables of the enums its fields reference.
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
      runHandler({ manifest, enumManifest: options?.enumManifest, argv });
    })
  };
}

interface ModelInfoArgv {
  readonly model?: string;
  readonly json?: boolean;
  readonly fields?: boolean;
}

interface ModelInfoHandlerInput {
  readonly manifest: CliModelManifest;
  readonly enumManifest?: Maybe<CliEnumManifest>;
  readonly argv: ModelInfoArgv;
}

function runHandler(input: ModelInfoHandlerInput): void {
  const { manifest, enumManifest, argv } = input;
  const query = typeof argv.model === 'string' && argv.model.length > 0 ? argv.model : undefined;

  if (query) {
    const entry = resolveCliModel(manifest, query);
    if (!entry) {
      throw new CliError({
        message: `No model matches '${query}'. Run \`model-info\` without an argument to list available models.`,
        code: 'MODEL_INFO_NOT_FOUND'
      });
    }

    if (argv.json) {
      const enums = enumManifest ? findReferencedCliEnums({ fields: entry.fields, manifest: enumManifest }) : [];
      outputResult(enums.length > 0 ? { ...entry, enums } : entry);
    } else if (argv.fields) {
      process.stdout.write(renderModelManifestFields(entry));
    } else {
      process.stdout.write(renderModelManifestEntry(entry, { enumManifest }));
    }
  } else if (argv.json) {
    outputResult(manifest);
  } else {
    process.stdout.write(renderModelManifestList(manifest));
  }
}
