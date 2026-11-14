import { type EmbeddedPackageRefs, type LoadCliPluginsResult, CliError, appendCliOutputWarnings, clearCliOutputWarnings, createOutputCommand, createOutputMiddleware, createPackageRefsDocsCommand, loadCliPlugins, outputError } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { type TrelloCliConfigFile, TRELLO_CLI_ENV_PREFIX, TRELLO_CLI_NAME, mergeTrelloCliOutputConfig, trelloCliConfigStore, trelloCliPaths, trelloCliTokenSourceResolver } from './config/cli.config';
import { type TrelloCliCommand, trelloCliCommandName, trelloCliYargsCommand } from './context/cli.command';
import { loadTrelloCliPackageRefs } from './docs/trello.docs.runtime';
import { type TrelloCliContextProvider, createTrelloCliContextProvider, setTrelloCliContextProvider } from './middleware/auth.middleware';
import { type TrelloCliPlugin, type TrelloCliPluginApi, type TrelloCliPluginContribution, type TrelloCliPluginReport, TRELLO_CLI_PLUGIN_API_VERSION, createTrelloCliPluginApi, readTrelloCliVersion, trelloCliPluginContributionError } from './plugin/trello.cli.plugin';
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
   * The environment the stock provider and the plugin loader read. Defaults to `process.env`.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
  /**
   * Plugins compiled into a host-built CLI. Loaded before any external plugin, and never turned off by
   * `--no-extensions`. Each mounts as `<cliName> <plugin name> …`.
   */
  readonly plugins?: Maybe<readonly TrelloCliPlugin[]>;
  /**
   * Whether to load external plugins (the config's `extensions`, `TRELLO_CLI_EXTENSIONS`, `--extension`). Defaults to
   * true.
   */
  readonly loadExternalPlugins?: Maybe<boolean>;
  /**
   * When true, any plugin that fails to load stops the run (`PLUGIN_LOAD_FAILED`, exit 1) before the arguments are
   * parsed. Defaults to false: a failed plugin is a warning and the other commands keep working.
   */
  readonly strictPlugins?: Maybe<boolean>;
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
 * passing its `commands`, its compiled-in `plugins` and a `contextProvider`.
 *
 * Before the arguments are parsed, the plugins load (host plugins, then the config's `extensions`,
 * `TRELLO_CLI_EXTENSIONS` and `--extension`); each mounts as `<cliName> <plugin name> …`. A plugin that fails is a
 * stderr line and a `meta.warnings` entry, unless `strictPlugins` is set.
 *
 * @param config - The name, arguments, extra commands, plugins, context provider and docs.
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

  const coreNames = [...TRELLO_CLI_CORE_COMMANDS.map(trelloCliCommandName), ...TRELLO_CLI_CONFIG_COMMAND_NAMES, 'help'];
  const reserved = new Set(coreNames);
  const hostCommands = (config.commands ?? []).filter((command) => {
    const clash = reserved.has(trelloCliCommandName(command));

    if (clash) {
      process.stderr.write(`[${cliName}] skipped host command "${trelloCliCommandName(command)}": it clashes with a built-in command\n`);
    }

    return !clash;
  });

  let configFile: Maybe<TrelloCliConfigFile>;
  let configFileWarning: Maybe<string>;

  try {
    configFile = await configStore.loadConfigFile();
  } catch (e) {
    configFileWarning = `the config file could not be read, so its extensions were not loaded: ${(e as Error).message}`;
  }

  const plugins = await loadTrelloCliPlugins({ config, cliName, env, argv, configDir: paths.configDir, configFile, reservedNames: [...coreNames, ...hostCommands.map(trelloCliCommandName)] });
  const pluginReport = trelloCliPluginReport(plugins);

  clearCliOutputWarnings();
  appendCliOutputWarnings([...(configFileWarning ? [configFileWarning] : []), ...plugins.warnings]);

  if (config.strictPlugins && pluginReport.some((x) => x.status === 'failed')) {
    outputError(new CliError({ message: `${pluginReport.filter((x) => x.status === 'failed').length} plugin(s) failed to load and strict plugin loading is on.`, code: 'PLUGIN_LOAD_FAILED', data: { plugins: pluginReport } }));
    process.exit(1);
    return;
  }

  const doctorCommand = trelloCliDoctorCommand({
    checks: () => plugins.loaded.flatMap((x) => (x.contribution.doctorChecks ?? []).map((check) => ({ source: x.plugin.name, check }))),
    report: () => ({ externalPluginsDisabled: plugins.externalDisabled, plugins: pluginReport })
  });

  const extensionsCommand: TrelloCliCommand = {
    command: 'extensions',
    describe: 'List the plugins: where each came from, its version, whether it loaded, and its commands',
    requires: 'none',
    handler: (_argv, ctx) => ctx.output.result({ externalDisabled: plugins.externalDisabled, plugins: pluginReport })
  };

  const pluginCommands: CommandModule[] = plugins.loaded.map((x) => {
    const versionSuffix = x.plugin.version ? ` (${x.plugin.version})` : '';
    return trelloCliYargsCommand(
      {
        command: x.plugin.name,
        describe: (x.plugin as TrelloCliPlugin).describe ?? `Commands of the ${x.plugin.name} plugin${versionSuffix}`,
        subcommands: x.contribution.commands ?? []
      },
      { pluginName: x.plugin.name }
    );
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
      .option('extension', { type: 'string', array: true, nargs: 1, global: true, describe: 'Load a plugin for this run: a path (relative to the cwd) or a package name. Repeatable' })
      .option('extensions', { type: 'boolean', default: true, global: true, describe: 'Load external plugins (--no-extensions turns off the config, TRELLO_CLI_EXTENSIONS and --extension ones)' })
      .middleware([outputMiddleware], true)
      .command([...TRELLO_CLI_CORE_COMMANDS, doctorCommand, extensionsCommand, ...hostCommands].map((command) => trelloCliYargsCommand(command)))
      .command(pluginCommands)
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

/**
 * Input for {@link loadTrelloCliPlugins}.
 */
interface LoadTrelloCliPluginsInput {
  readonly config: RunTrelloCliConfig;
  readonly cliName: string;
  readonly env: NodeJS.ProcessEnv;
  readonly argv: readonly string[];
  readonly configDir: string;
  readonly configFile: Maybe<TrelloCliConfigFile>;
  readonly reservedNames: readonly string[];
}

/**
 * Loads the run's plugins through the dbx-cli loader.
 *
 * @param input - The run config, the name, env and arguments, the config file and the names plugins may not take.
 * @returns The loader result.
 */
async function loadTrelloCliPlugins(input: LoadTrelloCliPluginsInput): Promise<LoadCliPluginsResult<TrelloCliPluginApi, TrelloCliPluginContribution>> {
  const { config, cliName, argv, configDir, configFile, reservedNames } = input;
  const hostVersion = readTrelloCliVersion();
  const loadExternal = config.loadExternalPlugins ?? true;

  return loadCliPlugins<TrelloCliPluginApi, TrelloCliPluginContribution>({
    envPrefix: TRELLO_CLI_ENV_PREFIX,
    apiVersion: TRELLO_CLI_PLUGIN_API_VERSION,
    hostVersion,
    hostPlugins: config.plugins,
    configExtensions: configFile?.extensions,
    configDir,
    argv,
    // turning external plugins off goes through the loader's own switch, so the report says so
    env: loadExternal ? input.env : { ...input.env, [`${TRELLO_CLI_ENV_PREFIX}_NO_EXTENSIONS`]: '1' },
    installDir: dirname(fileURLToPath(import.meta.url)),
    reservedNames,
    createApi: (plugin, context) => createTrelloCliPluginApi({ plugin, ...context, cliName, hostVersion }),
    validateContribution: trelloCliPluginContributionError
  });
}

/**
 * The plugin report `doctor` and `extensions` print: the loader's entries, plus each loaded plugin's command names.
 *
 * @param result - The loader result.
 * @returns The report.
 */
function trelloCliPluginReport(result: LoadCliPluginsResult<TrelloCliPluginApi, TrelloCliPluginContribution>): TrelloCliPluginReport[] {
  return result.report.map((entry) => {
    const loaded = entry.status === 'loaded' ? result.loaded.find((x) => x.report === entry) : undefined;
    return loaded == null ? entry : { ...entry, commands: (loaded.contribution.commands ?? []).map(trelloCliCommandName) };
  });
}
