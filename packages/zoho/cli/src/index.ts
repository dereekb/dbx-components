import yargs, { type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { authCommand } from './lib/commands/auth.command';
import { doctorCommand } from './lib/commands/doctor.command';
import { recruitCommand } from './lib/commands/recruit.command';
import { crmCommand } from './lib/commands/crm.command';
import { deskCommand } from './lib/commands/desk.command';
import { requestCommand } from './lib/commands/request.command';
import { outputCommand } from './lib/commands/output.command';
import { createAuthMiddleware } from './lib/middleware/auth.middleware';
import { outputError, configureOutputOptions } from './lib/util/output';
import { loadCliConfig, mergeCliConfig, resolveOutputConfig } from './lib/config/cli.config';

// MARK: Command Groups
/**
 * API commands that interact with Zoho services. These commands:
 * - require authentication (auth middleware)
 * - support pick/dump output filtering
 * - support --set-pick / --set-dump-dir auto-save
 */
const apiCommands: CommandModule[] = [recruitCommand, crmCommand, deskCommand, requestCommand];

/**
 * Config/utility commands that manage CLI settings. These commands:
 * - skip authentication
 * - skip pick/dump output filtering (their own JSON output is never filtered)
 */
const configCommands: CommandModule[] = [authCommand, outputCommand, doctorCommand];

function commandName(cmd: CommandModule): string {
  const raw = cmd.command as string;
  return raw.split(' ')[0];
}

const configCommandNames = new Set(configCommands.map(commandName));

function createOutputMiddleware() {
  return async (argv: any) => {
    const commandPath: string[] = argv._ ? (argv._ as string[]).map(String) : [];
    const topCommand = commandPath[0];

    // Save --set-dump-dir / --set-pick to per-command config when used on API commands
    const setDumpDir: string | undefined = argv.setDumpDir;
    const setPick: string | undefined = argv.setPick;
    const hasSetFlags = setDumpDir !== undefined || setPick !== undefined;

    if (hasSetFlags && topCommand && !configCommandNames.has(topCommand)) {
      const commandKey = commandPath.join('.');
      const commandConfig = {
        ...(setDumpDir !== undefined ? { dumpDir: setDumpDir } : {}),
        ...(setPick !== undefined ? { pick: setPick } : {})
      };

      await mergeCliConfig({ output: { commands: { [commandKey]: commandConfig } } });
    }

    // Resolve output options: --pick-all > CLI flags > set flags > per-command config > global config
    // Skip pick/dump resolution for non-API commands (output, auth, doctor) — their
    // own JSON output should never be filtered by saved pick fields.
    const isApiCommand = topCommand && !configCommandNames.has(topCommand);
    const config = await loadCliConfig();
    const resolved = isApiCommand
      ? resolveOutputConfig(config?.output, commandPath, {
          dumpDir: argv.dumpDir ?? setDumpDir,
          pick: argv.pick ?? setPick
        })
      : { dumpDir: undefined, pick: undefined };

    configureOutputOptions({
      dumpDir: resolved.dumpDir,
      pick: argv.pickAll ? undefined : resolved.pick,
      commandPath
    });
  };
}

async function main() {
  try {
    await yargs(hideBin(process.argv))
      .scriptName('zoho-cli')
      .usage('$0 <command> [options]')
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        default: false,
        global: true,
        describe: 'Verbose output'
      })
      .option('dump-dir', {
        type: 'string',
        global: true,
        describe: 'Directory to save full API responses as JSON files (overrides config)'
      })
      .option('pick', {
        type: 'string',
        global: true,
        describe: 'Comma-separated top-level fields to include in output (overrides config)'
      })
      .option('set-dump-dir', {
        type: 'string',
        global: true,
        describe: 'Save dump directory to config for this command and apply now'
      })
      .option('set-pick', {
        type: 'string',
        global: true,
        describe: 'Save pick fields to config for this command and apply now'
      })
      .option('pick-all', {
        type: 'boolean',
        global: true,
        describe: 'Ignore any configured pick filters and return full response data'
      })
      .middleware([createAuthMiddleware(configCommandNames), createOutputMiddleware()], true)
      .command(configCommands)
      .command(apiCommands)
      .demandCommand(1, 'Please specify a command. Use --help for available commands.')
      .strict()
      .fail(false)
      .help()
      .alias('help', 'h')
      .version(false)
      .wrap(Math.min(120, process.stdout.columns || 80))
      .parse();
  } catch (e) {
    outputError(e);
    process.exit(1);
  }
}

void main();
