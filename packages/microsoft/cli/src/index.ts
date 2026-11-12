import { createOutputCommand, createOutputMiddleware, outputError } from '@dereekb/dbx-cli';
import yargs, { type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AUTH_COMMAND } from './lib/commands/auth.command';
import { CALENDAR_COMMAND } from './lib/commands/calendar.command';
import { FILES_COMMAND } from './lib/commands/files.command';
import { MAIL_COMMAND } from './lib/commands/mail.command';
import { REQUEST_COMMAND } from './lib/commands/request.command';
import { MSGRAPH_CLI_NAME, MSGRAPH_CLI_SCOPES_ENV_VAR, mergeMsGraphCliOutputConfig, msGraphCliConfigStore, msGraphCliTokenSourceResolver } from './lib/config/cli.config';
import { createMsGraphCliAuthMiddleware } from './lib/middleware/auth.middleware';
import { configureMsGraphCliOutput } from './lib/util/output';

// registers the JWT secret-redaction pattern and the Graph error mapper with @dereekb/dbx-cli
configureMsGraphCliOutput();

const configStore = msGraphCliConfigStore();
const { envVarNames } = msGraphCliTokenSourceResolver();
const loadOutputConfig = async () => (await configStore.loadConfigFile())?.output;

const outputCommand = createOutputCommand({
  cliName: MSGRAPH_CLI_NAME,
  loadOutputConfig,
  mergeOutputConfig: (update) => mergeMsGraphCliOutputConfig(update, configStore),
  clearOutputConfig: () => configStore.updateConfigFile({ output: undefined })
});

/**
 * Graph commands: they need a token source (auth middleware) and support pick/dump output filtering.
 */
const apiCommands: CommandModule[] = [REQUEST_COMMAND, MAIL_COMMAND, CALENDAR_COMMAND, FILES_COMMAND];

/**
 * Config commands: they run without a token source and their output is never filtered.
 */
const configCommands: CommandModule[] = [AUTH_COMMAND, outputCommand];
const configCommandNames = new Set(configCommands.map((cmd) => (cmd.command as string).split(' ')[0]));

const outputMiddleware = createOutputMiddleware({
  cliName: MSGRAPH_CLI_NAME,
  skipCommands: configCommandNames,
  loadOutputConfig,
  saveCommandOutputConfig: async (commandKey, commandConfig) => {
    await mergeMsGraphCliOutputConfig({ commands: { [commandKey]: commandConfig } }, configStore);
  }
});

async function main() {
  try {
    await yargs(hideBin(process.argv))
      .scriptName(MSGRAPH_CLI_NAME)
      .usage('$0 <command> [options]')
      .option('verbose', { alias: 'v', type: 'boolean', default: false, global: true, describe: 'Verbose output' })
      .option('dump-dir', { type: 'string', global: true, describe: 'Directory to save full API responses as JSON files (overrides config)' })
      .option('pick', { type: 'string', global: true, describe: 'Comma-separated top-level fields to include in output (overrides config)' })
      .option('set-dump-dir', { type: 'string', global: true, describe: 'Save dump directory to config for this command and apply now' })
      .option('set-pick', { type: 'string', global: true, describe: 'Save pick fields to config for this command and apply now' })
      .option('pick-all', { type: 'boolean', global: true, describe: 'Ignore any configured pick filters and return full response data' })
      .option('token-source', { type: 'string', global: true, describe: `Saved token source to use for this run, e.g. dev or prod (overrides ${envVarNames.tokenSource}, ${envVarNames.tokenCommand} and the saved selection)` })
      .option('scopes', {
        type: 'string',
        global: true,
        describe: `Ask the token source for a token narrowed to these Graph scopes, space- or comma-separated (overrides ${MSGRAPH_CLI_SCOPES_ENV_VAR}). Forwarded to the token source as --scopes; a source that cannot narrow refuses it. An app-minted Microsoft token cannot be narrowed (Entra issues every consented scope): its scopes are set by the connection's preset.`
      })
      .middleware([createMsGraphCliAuthMiddleware({ skipCommands: configCommandNames }), outputMiddleware], true)
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

await main();
