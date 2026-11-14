import { type EmbeddedPackageRefs, createOutputCommand, createOutputMiddleware, createPackageRefsDocsCommand, outputError } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import yargs, { type CommandModule } from 'yargs';
import { hideBin } from 'yargs/helpers';
import { TRELLO_CLI_ATTACHMENT_COMMAND } from './commands/attachment.command';
import { TRELLO_CLI_AUTH_COMMAND } from './commands/auth.command';
import { TRELLO_CLI_BOARD_COMMAND } from './commands/board.command';
import { TRELLO_CLI_CARD_COMMAND } from './commands/card.command';
import { TRELLO_CLI_CHECKLIST_COMMAND } from './commands/checklist.command';
import { TRELLO_CLI_COMMENT_COMMAND } from './commands/comment.command';
import { TRELLO_CLI_CONFIG_COMMAND } from './commands/config.command';
import { trelloCliDoctorCommand } from './commands/doctor.command';
import { TRELLO_CLI_LIST_COMMAND } from './commands/list.command';
import { TRELLO_CLI_REQUEST_COMMAND } from './commands/request.command';
import { TRELLO_CLI_SEARCH_COMMAND } from './commands/search.command';
import { TRELLO_CLI_NAME, mergeTrelloCliOutputConfig, trelloCliConfigStore, trelloCliPaths, trelloCliTokenSourceResolver } from './config/cli.config';
import { type TrelloCliCommand, trelloCliCommandName, trelloCliYargsCommand } from './context/cli.command';
import { loadTrelloCliPackageRefs } from './docs/trello.docs.runtime';
import { type TrelloCliContextProvider, createTrelloCliContextProvider, setTrelloCliContextProvider } from './middleware/auth.middleware';
import { configureTrelloCliOutput } from './util/output';

/**
 * The top-level commands that run without credentials and whose output `--pick` / `--dump-dir` never filter.
 */
export const TRELLO_CLI_CONFIG_COMMAND_NAMES: readonly string[] = ['auth', 'config', 'output', 'docs', 'doctor', 'extensions'];

/**
 * Config for {@link runTrelloCli}.
 */
export interface RunTrelloCliConfig {
  /**
   * The binary name shown in help and messages. Defaults to `trello-cli`.
   */
  readonly cliName?: Maybe<string>;
  /**
   * The arguments to parse. Defaults to `process.argv` without the node and script paths.
   */
  readonly argv?: Maybe<readonly string[]>;
  /**
   * Extra top-level commands a host-built CLI adds. A name that clashes with a built-in command is skipped with a
   * stderr warning.
   */
  readonly commands?: Maybe<readonly TrelloCliCommand[]>;
  /**
   * Builds the context every command gets. Defaults to the stock provider (flags, env, config).
   */
  readonly contextProvider?: Maybe<TrelloCliContextProvider>;
  /**
   * The refs `docs` prints. Defaults to the ones the installed `@dereekb/trello` ships under `refs/`.
   */
  readonly refs?: Maybe<EmbeddedPackageRefs>;
  /**
   * The environment the stock provider reads. Defaults to `process.env`.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
}

/**
 * The built-in commands, in help order.
 */
export const TRELLO_CLI_CORE_COMMANDS: readonly TrelloCliCommand[] = [
  TRELLO_CLI_AUTH_COMMAND,
  TRELLO_CLI_CONFIG_COMMAND,
  TRELLO_CLI_BOARD_COMMAND,
  TRELLO_CLI_LIST_COMMAND,
  TRELLO_CLI_SEARCH_COMMAND,
  TRELLO_CLI_CARD_COMMAND,
  TRELLO_CLI_COMMENT_COMMAND,
  TRELLO_CLI_ATTACHMENT_COMMAND,
  TRELLO_CLI_CHECKLIST_COMMAND,
  TRELLO_CLI_REQUEST_COMMAND
];

/**
 * Runs trello-cli: parses the arguments, runs the command, prints its JSON envelope, and exits non-zero on failure (4
 * for missing credentials, 1 otherwise).
 *
 * The stock `trello-cli` binary is `runTrelloCli({ refs })`. A host can build its own CLI on the same commands by
 * passing its `commands` and a `contextProvider`.
 *
 * @param config - The name, arguments, extra commands, context provider and docs.
 *
 * @example
 * ```ts
 * await runTrelloCli({ cliName: 'my-trello', commands: [myCommand] });
 * ```
 */
export async function runTrelloCli(config: RunTrelloCliConfig = {}): Promise<void> {
  configureTrelloCliOutput();

  const cliName = config.cliName ?? TRELLO_CLI_NAME;
  const env = config.env ?? process.env;
  const argv = config.argv ?? hideBin(process.argv);
  const paths = trelloCliPaths(env);
  const configStore = trelloCliConfigStore(paths);
  const { envVarNames } = trelloCliTokenSourceResolver(env);
  const loadOutputConfig = async () => (await configStore.loadConfigFile())?.output;

  setTrelloCliContextProvider(config.contextProvider ?? createTrelloCliContextProvider({ env, cliName }));

  const builtIn: TrelloCliCommand[] = [...TRELLO_CLI_CORE_COMMANDS, trelloCliDoctorCommand()];
  const reserved = new Set([...builtIn.map(trelloCliCommandName), ...TRELLO_CLI_CONFIG_COMMAND_NAMES]);
  const hostCommands = (config.commands ?? []).filter((command) => {
    const clash = reserved.has(trelloCliCommandName(command));

    if (clash) {
      process.stderr.write(`[${cliName}] skipped host command "${trelloCliCommandName(command)}": it clashes with a built-in command\n`);
    }

    return !clash;
  });

  const rawCommands: CommandModule[] = [
    createOutputCommand({
      cliName,
      loadOutputConfig,
      mergeOutputConfig: (update) => mergeTrelloCliOutputConfig(update, configStore),
      clearOutputConfig: () => configStore.updateConfigFile({ output: undefined })
    }),
    createPackageRefsDocsCommand({ cliName, refs: config.refs ?? loadTrelloCliPackageRefs() })
  ];

  const outputMiddleware = createOutputMiddleware({
    cliName,
    skipCommands: new Set(TRELLO_CLI_CONFIG_COMMAND_NAMES),
    loadOutputConfig,
    saveCommandOutputConfig: async (commandKey, commandConfig) => {
      await mergeTrelloCliOutputConfig({ commands: { [commandKey]: commandConfig } }, configStore);
    }
  });

  try {
    await yargs([...argv])
      .scriptName(cliName)
      .usage('$0 <command> [options]')
      .option('verbose', { alias: 'v', type: 'boolean', default: false, global: true, describe: 'Verbose output (Trello errors are also logged to stderr)' })
      .option('board', { alias: 'b', type: 'string', global: true, describe: 'The board: id, shortLink or link (overrides config default-board and TRELLO_CLI_BOARD)' })
      .option('token-source', { type: 'string', global: true, describe: `Saved token source to use for this run (overrides ${envVarNames.tokenSource}, ${envVarNames.tokenCommand} and the saved selection)` })
      .option('api-url', { type: 'string', global: true, describe: 'The Trello api base url: https://api.trello.com/1 (default) or a loopback url for a local fake' })
      .option('dump-dir', { type: 'string', global: true, describe: 'Directory to save full API responses as JSON files (overrides config)' })
      .option('pick', { type: 'string', global: true, describe: 'Comma-separated fields to include in output (overrides config)' })
      .option('set-dump-dir', { type: 'string', global: true, describe: 'Save dump directory to config for this command and apply now' })
      .option('set-pick', { type: 'string', global: true, describe: 'Save pick fields to config for this command and apply now' })
      .option('pick-all', { type: 'boolean', global: true, describe: 'Ignore any configured pick filters and return full response data' })
      .middleware([outputMiddleware], true)
      .command([...builtIn, ...hostCommands].map((command) => trelloCliYargsCommand(command)))
      .command(rawCommands)
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
