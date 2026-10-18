import type { Argv, CommandModule } from 'yargs';
import { CliError, outputResult } from '../util/output';
import { wrapSyncCommandHandler } from '../util/handler';
import { DEFAULT_ENUM_INFO_COMMAND_NAME, cliEnumInfoNotFoundHint, renderCliEnumInfoLookupOutput, renderCliEnumList, resolveCliEnumInfoListOutput, resolveCliEnumInfoLookupOutput } from './enum-info-utils';
import type { CliEnumManifest } from './types';

/**
 * Options accepted by {@link buildEnumInfoCommand}.
 */
export interface BuildEnumInfoCommandOptions {
  /**
   * Override the command name. Defaults to {@link DEFAULT_ENUM_INFO_COMMAND_NAME} (`enum-info`).
   */
  readonly commandName?: string;
}

/**
 * Builds the top-level `enum-info [name..]` command — the CLI counterpart of the MCP `enum-info`
 * tool, decoding the raw values enum-typed model fields store.
 *
 * Without names: lists every registered enum. With names: trims each one and matches it exactly
 * against the enum declaration names, printing each match's value→name table. A miss is not an
 * error — it is reported in `notFound` with a hint, and the command still exits 0.
 *
 * Flags:
 *   - `--json` emits a structured `{ ok, data }` envelope whose `data` is the MCP tool's output
 *     shape: `{ enums, notFound?, hint? }`, or `{ names, total }` when no name is given.
 *
 * @param manifest - The generated enum manifest (e.g. `DEMO_CLI_ENUM_MANIFEST`).
 * @param options - Optional overrides; see {@link BuildEnumInfoCommandOptions}.
 * @returns A yargs `CommandModule` ready to be passed to `runCli({ configCommands })`.
 * @__NO_SIDE_EFFECTS__
 */
export function buildEnumInfoCommand(manifest: CliEnumManifest, options?: BuildEnumInfoCommandOptions): CommandModule {
  const commandName = options?.commandName ?? DEFAULT_ENUM_INFO_COMMAND_NAME;
  const { names, total } = resolveCliEnumInfoListOutput(manifest);
  const exampleSuffix = names[0] ? ` (e.g. "${names[0]}")` : '';
  return {
    command: `${commandName} [name..]`,
    describe: `Decode the raw values enum-typed model fields store: show an enum's value→name table (${total} enum${total === 1 ? '' : 's'}). Omit names to list them.`,
    builder: (yargs: Argv) => {
      return yargs
        .positional('name', {
          type: 'string',
          array: true,
          default: [] as string[],
          describe: `Enum declaration name(s), matched exactly${exampleSuffix}. Omit to list every enum.`
        })
        .option('json', {
          type: 'boolean',
          default: false,
          describe: 'Emit a structured JSON envelope instead of the human-readable table.'
        });
    },
    handler: wrapSyncCommandHandler((argv: any) => {
      runHandler({ manifest, commandName, argv });
    })
  };
}

interface EnumInfoArgv {
  readonly name?: readonly unknown[];
  readonly json?: boolean;
}

interface EnumInfoHandlerInput {
  readonly manifest: CliEnumManifest;
  readonly commandName: string;
  readonly argv: EnumInfoArgv;
}

function runHandler(input: EnumInfoHandlerInput): void {
  const { manifest, commandName, argv } = input;
  const raw = Array.isArray(argv.name) ? argv.name : [];

  if (raw.length === 0) {
    if (argv.json) {
      outputResult(resolveCliEnumInfoListOutput(manifest));
    } else {
      process.stdout.write(renderCliEnumList(manifest));
    }
  } else {
    const names = raw.map((name) => String(name).trim());

    if (names.some((name) => name.length === 0)) {
      throw new CliError({
        message: 'Enum names must be non-empty.',
        code: 'ENUM_INFO_INVALID_NAME',
        suggestion: cliEnumInfoNotFoundHint(commandName)
      });
    }

    const output = resolveCliEnumInfoLookupOutput({ names, manifest, commandName });

    if (argv.json) {
      outputResult(output);
    } else {
      process.stdout.write(renderCliEnumInfoLookupOutput(output));
    }
  }
}
