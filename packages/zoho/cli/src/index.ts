import { createOutputCommand, createOutputMiddleware } from '@dereekb/dbx-cli';
import yargs, { type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { authCommand } from './lib/commands/auth.command';
import { doctorCommand } from './lib/commands/doctor.command';
import { recruitCommand } from './lib/commands/recruit.command';
import { crmCommand } from './lib/commands/crm.command';
import { deskCommand } from './lib/commands/desk.command';
import { requestCommand } from './lib/commands/request.command';
import { createAuthMiddleware } from './lib/middleware/auth.middleware';
import { clearOutputConfig, loadCliConfig, mergeCliConfig } from './lib/config/cli.config';
// Importing this module registers the Zoho secret-redaction pattern + Zoho-aware error mapper
// with @dereekb/dbx-cli. The named import keeps the side effects scoped to this entry point.
import { outputError } from './lib/util/output';

const outputCommand = createOutputCommand({
  cliName: 'zoho-cli',
  loadOutputConfig: async () => (await loadCliConfig())?.output,
  mergeOutputConfig: (update) => mergeCliConfig({ output: update }),
  clearOutputConfig
});

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

const outputMiddleware = createOutputMiddleware({
  cliName: 'zoho-cli',
  skipCommands: configCommandNames,
  loadOutputConfig: async () => (await loadCliConfig())?.output,
  saveCommandOutputConfig: async (commandKey, commandConfig) => {
    await mergeCliConfig({ output: { commands: { [commandKey]: commandConfig } } });
  }
});

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
      .middleware([createAuthMiddleware(configCommandNames), outputMiddleware], true)
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
