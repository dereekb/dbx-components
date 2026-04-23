import type { CommandModule, Argv } from 'yargs';
import { loadCliConfig, mergeCliConfig, clearOutputConfig, type ZohoCliOutputConfig, type ZohoCliCommandOutputConfig } from '../config/cli.config';
import { outputResult, outputError } from '../util/output';
import { noop } from '../util/noop';

const outputSetCommand: CommandModule = {
  command: 'set',
  describe: 'Configure output settings (global or per-command)',
  builder: (yargs: Argv) =>
    yargs.option('command', { alias: 'c', type: 'string', describe: 'Command path to configure (e.g. desk.tickets.list)' }).check((argv) => {
      if (!argv.setDumpDir && !argv.setPick) {
        throw new Error('At least one of --set-dump-dir or --set-pick is required');
      }

      return true;
    }),
  handler: async (argv: any) => {
    try {
      const commandKey: string | undefined = argv.command;
      const dumpDir: string | undefined = argv.setDumpDir;
      const pick: string | undefined = argv.setPick;

      let outputUpdate: ZohoCliOutputConfig;

      if (commandKey) {
        const commandConfig: ZohoCliCommandOutputConfig = {
          ...(dumpDir !== undefined ? { dumpDir } : {}),
          ...(pick !== undefined ? { pick } : {})
        };

        outputUpdate = { commands: { [commandKey]: commandConfig } };
      } else {
        outputUpdate = {
          ...(dumpDir !== undefined ? { dumpDir } : {}),
          ...(pick !== undefined ? { pick } : {})
        };
      }

      const merged = await mergeCliConfig({ output: outputUpdate });
      outputResult({ saved: true, output: merged.output });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const outputShowCommand: CommandModule = {
  command: 'show',
  describe: 'Show current output configuration',
  builder: (yargs: Argv) => yargs,
  handler: async () => {
    try {
      const config = await loadCliConfig();
      outputResult({ output: config?.output ?? {} });
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

const outputClearCommand: CommandModule = {
  command: 'clear',
  describe: 'Clear output configuration (global or per-command)',
  builder: (yargs: Argv) => yargs.option('command', { alias: 'c', type: 'string', describe: 'Command path to clear (omit to clear all output config)' }),
  handler: async (argv: any) => {
    try {
      const commandKey: string | undefined = argv.command;

      if (commandKey) {
        const config = await loadCliConfig();
        const existingCommands = { ...config?.output?.commands };
        delete existingCommands[commandKey];
        const outputUpdate: ZohoCliOutputConfig = { ...config?.output, commands: existingCommands };
        await mergeCliConfig({ output: outputUpdate });
        outputResult({ cleared: true, command: commandKey });
      } else {
        await clearOutputConfig();
        outputResult({ cleared: true });
      }
    } catch (e) {
      outputError(e);
      process.exit(1);
    }
  }
};

export const outputCommand: CommandModule = {
  command: 'output',
  describe: 'Configure output settings (dump, field filtering)',
  builder: (yargs: Argv) => yargs.command(outputSetCommand).command(outputShowCommand).command(outputClearCommand).demandCommand(1),
  handler: noop
};
