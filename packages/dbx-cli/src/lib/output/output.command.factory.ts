import { type Maybe, noop } from '@dereekb/util';
import type { Argv, CommandModule } from 'yargs';
import { type CliCommandOutputConfig, type CliConfig, type CliOutputConfig, loadCliConfig, mergeCliConfig } from '../config/cli.config';
import { buildCliPaths } from '../config/paths';
import { type LoadOutputConfigFn } from '../middleware/output.middleware';
import { CliError, outputResult } from '../util/output';
import { wrapCommandHandler } from '../util/handler';

/**
 * Persists a partial output config update (global + per-command overrides). Implementations are
 * expected to merge with existing state — the same semantics used by {@link mergeCliConfig}.
 */
export type MergeOutputConfigFn = (update: CliOutputConfig) => Promise<unknown>;

/**
 * Wipes the persisted output config entirely (global defaults + every per-command override).
 */
export type ClearOutputConfigFn = () => Promise<unknown>;

export interface CreateOutputCommandInput {
  readonly cliName: string;
  /**
   * Reads the persisted output config. When omitted, defaults to dbx-cli's own
   * `<configDir>/config.json` via {@link loadCliConfig}.
   */
  readonly loadOutputConfig?: LoadOutputConfigFn;
  /**
   * Merges partial updates into the persisted output config. When omitted, defaults to
   * {@link mergeCliConfig} writing to `<configDir>/config.json`.
   */
  readonly mergeOutputConfig?: MergeOutputConfigFn;
  /**
   * Clears the persisted output config. When omitted, defaults to merging an empty/`undefined`
   * output slice via {@link mergeCliConfig}.
   */
  readonly clearOutputConfig?: ClearOutputConfigFn;
}

interface ResolveCallbacksInput {
  readonly cliName: string;
  readonly loadOutputConfig?: LoadOutputConfigFn;
  readonly mergeOutputConfig?: MergeOutputConfigFn;
  readonly clearOutputConfig?: ClearOutputConfigFn;
}

interface ResolvedCallbacks {
  readonly loadOutputConfig: LoadOutputConfigFn;
  readonly mergeOutputConfig: MergeOutputConfigFn;
  readonly clearOutputConfig: ClearOutputConfigFn;
}

function resolveCallbacks(input: ResolveCallbacksInput): ResolvedCallbacks {
  const paths = buildCliPaths({ cliName: input.cliName });

  const loadOutputConfig: LoadOutputConfigFn =
    input.loadOutputConfig ??
    (async () => {
      const config: Maybe<CliConfig> = await loadCliConfig({ configFilePath: paths.configFilePath });
      return config?.output;
    });

  const mergeOutputConfigFn: MergeOutputConfigFn = input.mergeOutputConfig ?? ((update) => mergeCliConfig({ configFilePath: paths.configFilePath, configDir: paths.configDir, updates: { output: update } }));

  const clearOutputConfigFn: ClearOutputConfigFn = input.clearOutputConfig ?? (() => mergeCliConfig({ configFilePath: paths.configFilePath, configDir: paths.configDir, updates: { output: { dumpDir: undefined, pick: undefined, commands: undefined } } }));

  return { loadOutputConfig, mergeOutputConfig: mergeOutputConfigFn, clearOutputConfig: clearOutputConfigFn };
}

/**
 * Factory for the `output` config command.
 *
 * Subcommands:
 * - `output set [--command <key>] [--set-dump-dir <path>] [--set-pick <fields>]`
 * - `output show`
 * - `output clear [--command <key>]`
 *
 * The factory accepts callbacks for reading/writing the persisted output config so each CLI can
 * plug in its own on-disk shape (e.g. dbx-cli's flat `<config>.output`, zoho-cli's
 * shared/recruit/crm/desk wrapper). When omitted, the dbx-cli defaults persist to
 * `<configDir>/config.json`.
 *
 * The `--set-dump-dir` / `--set-pick` flags on `output set` reuse the global flags registered by
 * {@link createCli}, so the same syntax `<cli> output set --command foo.bar --set-pick a,b` works
 * across CLIs.
 *
 * @param input - Factory configuration.
 * @param input.cliName - The CLI's binary name (used to derive the default config path).
 * @param input.loadOutputConfig - Optional override for reading the persisted output config.
 * @param input.mergeOutputConfig - Optional override for persisting partial output-config updates.
 * @param input.clearOutputConfig - Optional override for clearing the persisted output config entirely.
 * @returns A yargs `CommandModule` exposing the full `output` subcommand surface.
 */
export function createOutputCommand(input: CreateOutputCommandInput): CommandModule {
  const callbacks = resolveCallbacks(input);

  const setCommand: CommandModule = {
    command: 'set',
    describe: 'Configure output settings (global or per-command)',
    builder: (yargs: Argv) =>
      yargs.option('command', { alias: 'c', type: 'string', describe: 'Command path to configure (e.g. recruit.list)' }).check((argv) => {
        if (argv.setDumpDir == null && argv.setPick == null) {
          throw new Error('At least one of --set-dump-dir or --set-pick is required');
        }

        return true;
      }),
    handler: wrapCommandHandler(async (argv: any) => {
      const commandKey: string | undefined = argv.command;
      const dumpDir: string | undefined = argv.setDumpDir;
      const pick: string | undefined = argv.setPick;

      let outputUpdate: CliOutputConfig;

      if (commandKey) {
        const commandConfig: CliCommandOutputConfig = {
          ...(dumpDir === undefined ? {} : { dumpDir }),
          ...(pick === undefined ? {} : { pick })
        };

        outputUpdate = { commands: { [commandKey]: commandConfig } };
      } else {
        outputUpdate = {
          ...(dumpDir === undefined ? {} : { dumpDir }),
          ...(pick === undefined ? {} : { pick })
        };
      }

      await callbacks.mergeOutputConfig(outputUpdate);
      const next = await callbacks.loadOutputConfig();
      outputResult({ saved: true, output: next ?? {} });
    })
  };

  const showCommand: CommandModule = {
    command: 'show',
    describe: 'Show current output configuration',
    builder: (yargs: Argv) => yargs,
    handler: wrapCommandHandler(async () => {
      const output = await callbacks.loadOutputConfig();
      outputResult({ output: output ?? {} });
    })
  };

  const clearCommand: CommandModule = {
    command: 'clear',
    describe: 'Clear output configuration (global or per-command)',
    builder: (yargs: Argv) => yargs.option('command', { alias: 'c', type: 'string', describe: 'Command path to clear (omit to clear all output config)' }),
    handler: wrapCommandHandler(async (argv: any) => {
      const commandKey: string | undefined = argv.command;

      if (commandKey) {
        const existing = await callbacks.loadOutputConfig();

        if (!existing?.commands?.[commandKey]) {
          throw new CliError({ message: `No per-command output config for "${commandKey}".`, code: 'OUTPUT_COMMAND_NOT_FOUND' });
        }

        const nextCommands = { ...existing.commands };
        delete nextCommands[commandKey];
        await callbacks.mergeOutputConfig({ ...existing, commands: nextCommands });
        outputResult({ cleared: true, command: commandKey });
      } else {
        await callbacks.clearOutputConfig();
        outputResult({ cleared: true });
      }
    })
  };

  return {
    command: 'output',
    describe: 'Configure output settings (dump, field filtering)',
    builder: (yargs: Argv) => yargs.command(setCommand).command(showCommand).command(clearCommand).demandCommand(1, 'Specify an output subcommand.'),
    handler: noop
  };
}
