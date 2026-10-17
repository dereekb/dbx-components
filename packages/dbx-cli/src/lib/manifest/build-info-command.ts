import { buildModelManifestCatalog, MODEL_MANIFEST_CATALOG_HIT_KINDS, ModelManifestInfoInputError, resolveModelManifestInfoOutput, type ModelManifestCatalog, type ModelManifestInfoInput } from '@dereekb/firebase/manifest';
import { type Maybe } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { CliError, outputResult } from '../util/output';
import { wrapSyncCommandHandler } from '../util/handler';
import { buildCliInfoHints, DEFAULT_INFO_COMMAND_NAME, renderCliInfoOutput } from './info-utils';
import type { CliEnumManifest, CliModelManifest } from './types';

/**
 * Input of {@link buildInfoCommand}.
 */
export interface BuildInfoCommandInput {
  /**
   * The generated model manifest (e.g. `DEMO_CLI_MODEL_MANIFEST`).
   */
  readonly modelManifest?: Maybe<CliModelManifest>;
  /**
   * The generated enum manifest (e.g. `DEMO_CLI_ENUM_MANIFEST`).
   */
  readonly enumManifest?: Maybe<CliEnumManifest>;
  /**
   * Override the command name. Defaults to {@link DEFAULT_INFO_COMMAND_NAME} (`info`).
   */
  readonly commandName?: string;
}

/**
 * Builds the top-level `info [query..]` command — the CLI counterpart of the MCP `<prefix>_api_info` tool, describing the
 * data model: models, their stored fields, and enum value tables with the fields that use them.
 *
 * Without arguments: an overview of the model types by group and the enum names. Positional words are joined into a
 * search query returning one-line model, field, and enum hits (`--kind` narrows, `--limit` / `--offset` page).
 * `--model` / `--enum` (repeatable) look entries up by name. Pass at most one of a query, `--model`, or `--enum`; an
 * invalid combination exits 1 with `MODEL_MANIFEST_INFO_INVALID_INPUT`. Lookup misses are not errors.
 *
 * Flags:
 *   - `--json` emits a structured `{ ok, data }` envelope whose `data` is exactly the MCP tool's output.
 *
 * @param input - The generated manifests and an optional command name.
 * @returns A yargs `CommandModule` ready to be passed to `runCli({ configCommands })`.
 * @__NO_SIDE_EFFECTS__
 */
export function buildInfoCommand(input: BuildInfoCommandInput): CommandModule {
  const { modelManifest, enumManifest } = input;
  const commandName = input.commandName ?? DEFAULT_INFO_COMMAND_NAME;
  const modelCount = modelManifest?.length ?? 0;
  const enumCount = Object.keys(enumManifest ?? {}).length;
  let catalog: Maybe<ModelManifestCatalog>;

  const getCatalog = () => {
    catalog ??= buildModelManifestCatalog({ models: modelManifest, enums: enumManifest });
    return catalog;
  };

  return {
    command: `${commandName} [query..]`,
    describe: `Describe the data model (${modelCount} model${modelCount === 1 ? '' : 's'}, ${enumCount} enum${enumCount === 1 ? '' : 's'}): search models, fields and enums, or look them up by name. No arguments: an overview.`,
    builder: (yargs: Argv) => {
      return yargs
        .positional('query', {
          type: 'string',
          array: true,
          default: [] as string[],
          describe: 'One to three keywords. Returns one-line model, field, and enum hits.'
        })
        .option('model', {
          type: 'string',
          describe: 'A model to show in full, matched by modelType, identity const, or collection prefix. Repeat for several.'
        })
        .option('enum', {
          type: 'string',
          describe: 'An enum to show with the fields that use it, matched by declaration name. Repeat for several.'
        })
        .option('kind', {
          type: 'string',
          choices: [...MODEL_MANIFEST_CATALOG_HIT_KINDS],
          describe: 'Restrict search hits to one kind. Without a query, lists every entry of that kind.'
        })
        .option('limit', {
          type: 'number',
          describe: 'Maximum search hits (default 10, max 50).'
        })
        .option('offset', {
          type: 'number',
          describe: 'Number of search hits to skip, for paging.'
        })
        .option('json', {
          type: 'boolean',
          default: false,
          describe: 'Emit a structured JSON envelope instead of the human-readable text.'
        });
    },
    handler: wrapSyncCommandHandler((argv: any) => {
      runHandler({ getCatalog, enumManifest, commandName, argv });
    })
  };
}

interface InfoArgv {
  readonly query?: readonly unknown[];
  readonly model?: string | readonly string[];
  readonly enum?: string | readonly string[];
  readonly kind?: ModelManifestInfoInput['kind'];
  readonly limit?: number;
  readonly offset?: number;
  readonly json?: boolean;
}

interface InfoHandlerInput {
  readonly getCatalog: () => ModelManifestCatalog;
  readonly enumManifest: Maybe<CliEnumManifest>;
  readonly commandName: string;
  readonly argv: InfoArgv;
}

function runHandler(input: InfoHandlerInput): void {
  const { getCatalog, enumManifest, commandName, argv } = input;
  const hints = buildCliInfoHints(commandName);
  const words = Array.isArray(argv.query) ? argv.query.map(String) : [];
  const query = words.length > 0 ? words.join(' ') : undefined;
  const infoInput: ModelManifestInfoInput = { query, model: argv.model, enum: argv.enum, kind: argv.kind, limit: argv.limit, offset: argv.offset };
  let output;

  try {
    output = resolveModelManifestInfoOutput({ catalog: getCatalog(), input: infoInput, hints });
  } catch (error) {
    if (error instanceof ModelManifestInfoInputError) {
      throw new CliError({ message: error.message, code: error.code, suggestion: hints.overview });
    }

    throw error;
  }

  if (argv.json) {
    outputResult(output);
  } else {
    process.stdout.write(renderCliInfoOutput(output, { offset: argv.offset, enumManifest }));
  }
}
