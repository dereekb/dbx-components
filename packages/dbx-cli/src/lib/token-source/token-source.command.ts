import type { Argv, CommandModule } from 'yargs';
import { type Maybe } from '@dereekb/util';
import { readJsonFile, writeJsonFile } from '@dereekb/nestjs';
import { CLI_CONFIG_FILE_MODE } from '../config/cli.config';
import { type CliPaths } from '../config/paths';
import { wrapCommandHandler } from '../util/handler';
import { CliError, outputResult } from '../util/output';
import {
  type CliActiveTokenSource,
  type CliTokenSourceConfig,
  type CliTokenSourceConfigFile,
  type CliTokenSourceName,
  type CliTokenSourceResolver,
  type CliTokenSourceSelection,
  CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE,
  DEFAULT_CLI_TOKEN_SOURCE_NAME,
  assertCliTokenSourceName,
  cliTokenSourceSelectionFromArgv
} from './token-source.config';
import { type CliTokenSourceScopesParser, type CliTokenSourceToken, type CliTokenSourceTokenMapper, clearCachedCliTokenSourceToken, loadCachedCliTokenSourceToken } from './token-source';

// MARK: Config File
/**
 * Reads and writes the token-source keys of a CLI's config file.
 */
export interface CliTokenSourceConfigStore<C extends CliTokenSourceConfig = CliTokenSourceConfig, F extends CliTokenSourceConfigFile<C> = CliTokenSourceConfigFile<C>> {
  /**
   * Reads the raw config file, with no env vars layered over it.
   */
  loadConfigFile(): Promise<Maybe<F>>;
  /**
   * Replaces the top-level keys present in the update (a key present as `undefined` removes it) and
   * leaves every other key of the file untouched.
   */
  updateConfigFile(update: Partial<F>): Promise<unknown>;
}

/**
 * A {@link CliTokenSourceConfigStore} whose update resolves the config as saved.
 */
export interface CliTokenSourceJsonConfigStore<C extends CliTokenSourceConfig = CliTokenSourceConfig, F extends CliTokenSourceConfigFile<C> = CliTokenSourceConfigFile<C>> extends CliTokenSourceConfigStore<C, F> {
  /**
   * Replaces the top-level keys present in the update and resolves the saved config, or undefined when nothing was written.
   */
  updateConfigFile(update: Partial<F>): Promise<Maybe<F>>;
}

/**
 * A {@link CliTokenSourceConfigStore} over a plain JSON config file (written with {@link CLI_CONFIG_FILE_MODE}).
 *
 * Nothing is written when there is no config file and the update sets nothing.
 *
 * @param paths - The CLI's paths, from `buildCliPaths()`.
 * @returns The store.
 *
 * @example
 * ```typescript
 * const store = cliTokenSourceJsonConfigStore(buildCliPaths({ cliName: 'msgraph-cli' }));
 * ```
 */
export function cliTokenSourceJsonConfigStore<C extends CliTokenSourceConfig = CliTokenSourceConfig, F extends CliTokenSourceConfigFile<C> = CliTokenSourceConfigFile<C>>(paths: Pick<CliPaths, 'configDir' | 'configFilePath'>): CliTokenSourceJsonConfigStore<C, F> {
  const loadConfigFile = () => readJsonFile<F>(paths.configFilePath);

  async function updateConfigFile(update: Partial<F>): Promise<Maybe<F>> {
    const existing = await loadConfigFile();
    let result: Maybe<F>;

    if (existing != null || Object.values(update).some((x) => x != null)) {
      result = { ...existing, ...update } as F;
      await writeJsonFile({ filePath: paths.configFilePath, dirPath: paths.configDir, data: result, mode: CLI_CONFIG_FILE_MODE });
    }

    return result;
  }

  return { loadConfigFile, updateConfigFile };
}

// MARK: Commands
/**
 * Config shared by the `auth token-source` functions and {@link buildCliTokenSourceAuthCommand}.
 */
export interface CliTokenSourceCommandConfig<C extends CliTokenSourceConfig = CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken> extends CliTokenSourceConfigStore<C> {
  readonly resolver: CliTokenSourceResolver<C>;
  /**
   * The CLI's token file, where the sources' tokens are cached.
   */
  readonly tokenCachePath: string;
  /**
   * Builds the block `set` saves. `options` are the parsed `set` arguments (see `setOptions`); `previous`
   * is the block saved under the name before, unvalidated. Defaults to `{ command }`.
   */
  readonly buildBlock?: Maybe<(input: { readonly command: string; readonly options: Readonly<Record<string, unknown>>; readonly previous: Maybe<C> }) => C>;
  /**
   * The source's own fields as `set` / `use` / `show` print them (e.g. zoho-cli's `apiMode`, defaulted).
   * Defaults to none.
   */
  readonly describeSource?: Maybe<(source: Maybe<C>) => Record<string, unknown>>;
  /**
   * Parses the cached token's scopes for `show`. Defaults to whitespace- or comma-delimited scopes.
   */
  readonly parseScopes?: Maybe<CliTokenSourceScopesParser>;
  /**
   * Maps the cached token `show` reads to the CLI's own token type, handed the raw token-file entry.
   * Defaults to the token as is.
   */
  readonly mapToken?: Maybe<CliTokenSourceTokenMapper<T>>;
  /**
   * What `show` prints about the active source's cached token (never the token). Defaults to its
   * `expiresAt`, `scopes`, and `providerType`.
   */
  readonly describeCachedToken?: Maybe<(token: T) => Record<string, unknown>>;
}

/**
 * The token-source env vars that are set, which win over the saved selection on the runs where they are set.
 */
export interface CliTokenSourceEnvOverrides {
  /**
   * The `<CLI>_TOKEN_COMMAND` command, when set.
   */
  readonly envOverride?: string;
  /**
   * The `<CLI>_TOKEN_SOURCE` name, when set.
   */
  readonly envSelection?: string;
}

function cliTokenSourceEnvOverrides(resolver: CliTokenSourceResolver<CliTokenSourceConfig>): CliTokenSourceEnvOverrides {
  const envOverride = resolver.tokenCommandFromEnv();
  const envSelection = resolver.tokenSourceNameFromEnv();
  return { ...(envOverride ? { envOverride } : {}), ...(envSelection ? { envSelection } : {}) };
}

function cliTokenSourceNameOption(name: Maybe<string>): CliTokenSourceName {
  return name?.trim() ? assertCliTokenSourceName(name) : DEFAULT_CLI_TOKEN_SOURCE_NAME;
}

/**
 * Input for {@link setCliTokenSource}.
 */
export interface SetCliTokenSourceInput {
  /**
   * The token source command, e.g. `demo-cli external-token zoho_admin --env external-token`.
   */
  readonly command: string;
  /**
   * The name to save it under. Defaults to {@link DEFAULT_CLI_TOKEN_SOURCE_NAME}, the unnamed `tokenSource` block.
   */
  readonly name?: Maybe<string>;
  /**
   * The parsed `set` options, handed to {@link CliTokenSourceCommandConfig.buildBlock}.
   */
  readonly options?: Maybe<Readonly<Record<string, unknown>>>;
}

/**
 * Result of {@link setCliTokenSource}.
 */
export interface SetCliTokenSourceResult extends CliTokenSourceEnvOverrides {
  readonly saved: true;
  readonly name: CliTokenSourceName;
  readonly command: string;
  readonly [key: string]: unknown;
}

/**
 * Saves a token source (`auth token-source set`): the unnamed `tokenSource` block, or a named entry of `tokenSources`.
 *
 * Writes only the token-source keys. The cached token of a replaced command is removed from the token file.
 *
 * @param config - The CLI's token-source command config.
 * @param input - The command, name, and `set` options.
 * @returns What was saved.
 * @throws {Error} When the command is blank or the name is invalid.
 */
export async function setCliTokenSource<C extends CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken>(config: CliTokenSourceCommandConfig<C, T>, input: SetCliTokenSourceInput): Promise<SetCliTokenSourceResult> {
  const { resolver, tokenCachePath } = config;
  const command = input.command.trim();

  if (!command) {
    throw new Error('The token source command cannot be empty.');
  }

  const name = cliTokenSourceNameOption(input.name);
  const fileConfig = await config.loadConfigFile();
  const isDefault = name === DEFAULT_CLI_TOKEN_SOURCE_NAME;
  const previous = resolver.savedTokenSourceBlock(fileConfig, name);
  const block: C = config.buildBlock ? config.buildBlock({ command, options: input.options ?? {}, previous }) : ({ command } as C);

  await config.updateConfigFile(isDefault ? { tokenSource: block } : { tokenSources: { ...fileConfig?.tokenSources, [name]: block } });

  const previousCommand = previous?.command?.trim();

  if (previousCommand && previousCommand !== command) {
    await clearCachedCliTokenSourceToken({ command: previousCommand, tokenCachePath });
  }

  return { saved: true, name, command, ...config.describeSource?.(block), ...cliTokenSourceEnvOverrides(resolver) };
}

/**
 * Result of {@link useCliTokenSource}.
 */
export interface UseCliTokenSourceResult extends CliTokenSourceEnvOverrides {
  readonly activeTokenSource: CliTokenSourceName;
  /**
   * The selected source's command, or null when {@link DEFAULT_CLI_TOKEN_SOURCE_NAME} is selected and none is saved.
   */
  readonly command: Maybe<string>;
  readonly [key: string]: unknown;
}

/**
 * Selects the saved token source used when a run selects none (`auth token-source use <name>`).
 *
 * Selecting {@link DEFAULT_CLI_TOKEN_SOURCE_NAME} removes the saved selection, so the unnamed
 * `tokenSource` block (when saved) applies again.
 *
 * @param config - The CLI's token-source command config.
 * @param name - The source's name.
 * @returns The selection and the selected source.
 * @throws {Error} When the name is invalid.
 * @throws {CliError} A {@link CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE} error, with the save hint as its suggestion, when no source is saved under the name.
 */
export async function useCliTokenSource<C extends CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken>(config: CliTokenSourceCommandConfig<C, T>, name: string): Promise<UseCliTokenSourceResult> {
  const { resolver } = config;
  const sourceName = cliTokenSourceNameOption(name);
  const fileConfig = await config.loadConfigFile();
  const saved = resolver.savedTokenSource(fileConfig, sourceName);
  const isDefault = sourceName === DEFAULT_CLI_TOKEN_SOURCE_NAME;

  if (!saved && !isDefault) {
    const names = resolver.savedTokenSourceNames(fileConfig);
    throw new CliError({
      message: `No token source is saved as "${sourceName}". Saved token sources: ${names.length > 0 ? names.join(', ') : 'none'}.`,
      code: CLI_TOKEN_SOURCE_UNKNOWN_ERROR_CODE,
      suggestion: `Save it with: ${resolver.setHint(sourceName)}`
    });
  }

  await config.updateConfigFile({ activeTokenSource: isDefault ? undefined : sourceName });
  return { activeTokenSource: sourceName, command: saved?.command ?? null, ...config.describeSource?.(saved), ...cliTokenSourceEnvOverrides(resolver) };
}

/**
 * Input for {@link clearCliTokenSource}.
 */
export interface ClearCliTokenSourceInput {
  /**
   * The source to remove. Defaults to {@link DEFAULT_CLI_TOKEN_SOURCE_NAME}, the unnamed `tokenSource` block.
   */
  readonly name?: Maybe<string>;
}

/**
 * Result of {@link clearCliTokenSource}.
 */
export interface ClearCliTokenSourceResult extends CliTokenSourceEnvOverrides {
  readonly cleared: boolean;
  readonly name: CliTokenSourceName;
  /**
   * The command that was removed, when one was saved.
   */
  readonly command?: string;
  /**
   * True when the removed source was the saved selection, which was removed with it.
   */
  readonly activeTokenSourceCleared?: true;
}

/**
 * Removes a saved token source (`auth token-source clear`) and its cached token.
 *
 * Only that source is removed — and the saved selection, when it named the source.
 *
 * @param config - The CLI's token-source command config.
 * @param input - The source to remove.
 * @returns What was cleared.
 * @throws {Error} When the name is invalid.
 */
export async function clearCliTokenSource<C extends CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken>(config: CliTokenSourceCommandConfig<C, T>, input?: Maybe<ClearCliTokenSourceInput>): Promise<ClearCliTokenSourceResult> {
  const { resolver, tokenCachePath } = config;
  const name = cliTokenSourceNameOption(input?.name);
  const fileConfig = await config.loadConfigFile();
  const isDefault = name === DEFAULT_CLI_TOKEN_SOURCE_NAME;
  const previous = resolver.savedTokenSourceBlock(fileConfig, name)?.command;
  const clearsSelection = !isDefault && fileConfig?.activeTokenSource === name;

  if (previous != null) {
    if (isDefault) {
      await config.updateConfigFile({ tokenSource: undefined });
    } else {
      const { [name]: _removed, ...tokenSources } = fileConfig?.tokenSources ?? {};
      await config.updateConfigFile({ tokenSources: Object.keys(tokenSources).length > 0 ? tokenSources : undefined, ...(clearsSelection ? { activeTokenSource: undefined } : {}) });
    }

    await clearCachedCliTokenSourceToken({ command: previous, tokenCachePath });
  }

  return { cleared: previous != null, name, ...(previous ? { command: previous } : {}), ...(previous != null && clearsSelection ? { activeTokenSourceCleared: true as const } : {}), ...cliTokenSourceEnvOverrides(resolver) };
}

/**
 * A saved token source, as `auth token-source show` lists it.
 */
export interface CliTokenSourceSavedSource {
  readonly name: CliTokenSourceName;
  readonly command: string;
  /**
   * Whether this source is the one in effect for the run.
   */
  readonly active: boolean;
  readonly [key: string]: unknown;
}

/**
 * Result of {@link buildCliTokenSourceShowResult}.
 */
export interface CliTokenSourceShowResult<C extends CliTokenSourceConfig = CliTokenSourceConfig> {
  /**
   * The command of the saved unnamed source ({@link DEFAULT_CLI_TOKEN_SOURCE_NAME}), or null.
   */
  readonly saved: Maybe<string>;
  /**
   * Every saved source, the unnamed one first.
   */
  readonly sources: readonly CliTokenSourceSavedSource[];
  /**
   * The saved selection (`auth token-source use`), or null when the unnamed source applies.
   */
  readonly activeTokenSource: Maybe<CliTokenSourceName>;
  /**
   * The `<CLI>_TOKEN_SOURCE` name, or null.
   */
  readonly envSelection: Maybe<CliTokenSourceName>;
  /**
   * The `<CLI>_TOKEN_COMMAND` command, or null.
   */
  readonly envOverride: Maybe<string>;
  /**
   * The source in effect, or null when none is.
   */
  readonly active: Maybe<CliActiveTokenSource<C>>;
  /**
   * Why no source could be selected (a selected name with no saved source), when that is the case.
   */
  readonly error?: string;
  /**
   * How to fix {@link CliTokenSourceShowResult.error} (e.g. the `set` command that saves the missing source), when known.
   */
  readonly suggestion?: string;
  /**
   * What the active source's cached token covers, or null when no token is cached. Never the token.
   */
  readonly cached: Maybe<Record<string, unknown>>;
}

/**
 * Builds the `auth token-source show` (alias `list`) result. Does NOT run any command: only a token
 * already cached in the token file is described.
 *
 * @param config - The CLI's token-source command config.
 * @param selection - The `--token-source` flag, when given.
 * @returns The saved sources and selection, the env overrides, the active source, and the cached token's description.
 */
export async function buildCliTokenSourceShowResult<C extends CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken>(config: CliTokenSourceCommandConfig<C, T>, selection?: Maybe<CliTokenSourceSelection>): Promise<CliTokenSourceShowResult<C>> {
  const { resolver, tokenCachePath } = config;
  const fileConfig = await config.loadConfigFile();
  let active: Maybe<CliActiveTokenSource<C>>;
  let error: Maybe<string>;
  let suggestion: Maybe<string>;

  try {
    active = resolver.resolveActiveTokenSource(fileConfig, selection);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    suggestion = e instanceof CliError ? e.suggestion : undefined;
  }

  const sources = resolver.savedTokenSourceNames(fileConfig).map((name): CliTokenSourceSavedSource => {
    let source: Maybe<C>;

    try {
      source = resolver.savedTokenSource(fileConfig, name);
    } catch {
      // an invalid stored field; listed with the raw command so it can be fixed with `set`
    }

    const command = source?.command ?? resolver.savedTokenSourceBlock(fileConfig, name)?.command ?? '';
    return { name, command, ...config.describeSource?.(source), active: active?.name === name };
  });

  const cachedToken = active ? await loadCachedCliTokenSourceToken<T>({ command: active.command, tokenCachePath, parseScopes: config.parseScopes, mapToken: config.mapToken }) : undefined;
  let cached: Maybe<Record<string, unknown>> = null;

  if (cachedToken) {
    cached = config.describeCachedToken ? config.describeCachedToken(cachedToken) : { expiresAt: cachedToken.expiresAt, scopes: cachedToken.scopes, providerType: cachedToken.providerType };
  }

  return {
    saved: fileConfig?.tokenSource?.command ?? null,
    sources,
    activeTokenSource: fileConfig?.activeTokenSource ?? null,
    envSelection: resolver.tokenSourceNameFromEnv() ?? null,
    envOverride: resolver.tokenCommandFromEnv() ?? null,
    active: active ?? null,
    ...(error ? { error } : {}),
    ...(suggestion ? { suggestion } : {}),
    cached
  };
}

/**
 * Help-text overrides for {@link buildCliTokenSourceAuthCommand}.
 */
export interface CliTokenSourceAuthCommandDescriptions {
  /**
   * The `token-source` command's own description.
   */
  readonly tokenSource?: Maybe<string>;
  readonly show?: Maybe<string>;
  readonly clear?: Maybe<string>;
}

/**
 * Options for {@link buildCliTokenSourceAuthCommand}.
 */
export interface BuildCliTokenSourceAuthCommandOptions<C extends CliTokenSourceConfig = CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken> extends CliTokenSourceCommandConfig<C, T> {
  /**
   * What the source's command prints, for the help text, e.g. `a Microsoft Graph access token bundle`.
   */
  readonly tokenDescription?: Maybe<string>;
  /**
   * An example token source command, e.g. `demo-cli external-token microsoft --env msgraph-read`.
   */
  readonly exampleCommand?: Maybe<string>;
  /**
   * Adds the CLI's own `set` options (read back by {@link CliTokenSourceCommandConfig.buildBlock}).
   */
  readonly setOptions?: Maybe<(yargs: Argv) => Argv>;
  /**
   * The `set` examples, as `[command, description]` pairs. Defaults to an unnamed and a named source
   * built from {@link exampleCommand}.
   */
  readonly setExamples?: Maybe<ReadonlyArray<readonly [string, string]>>;
  /**
   * Overrides the help text of the `token-source` command and its `show` and `clear` subcommands.
   */
  readonly describe?: Maybe<CliTokenSourceAuthCommandDescriptions>;
  /**
   * The follow-up command `set` suggests, given the saved name. Defaults to `<cli> auth show [--token-source <name>]`.
   */
  readonly nextStep?: Maybe<(name: CliTokenSourceName) => string>;
}

/**
 * Builds the `auth token-source` command with its `set <token-command>`, `use <name>`, `show` (alias
 * `list`), and `clear` subcommands.
 *
 * @param options - The CLI's token-source command config and help text.
 * @returns The yargs command, to register under the CLI's `auth` command.
 *
 * @example
 * ```typescript
 * yargs.command(buildCliTokenSourceAuthCommand({ resolver, tokenCachePath, ...cliTokenSourceJsonConfigStore(paths) }));
 * ```
 */
export function buildCliTokenSourceAuthCommand<C extends CliTokenSourceConfig, T extends CliTokenSourceToken = CliTokenSourceToken>(options: BuildCliTokenSourceAuthCommandOptions<C, T>): CommandModule {
  const { resolver } = options;
  const { cliName, envVarNames } = resolver;
  const tokenDescription = options.tokenDescription ?? 'an access token bundle';
  const exampleCommand = options.exampleCommand ?? 'demo-cli external-token <providerType>';
  const nameDescribe = `Name of the token source (default: "${DEFAULT_CLI_TOKEN_SOURCE_NAME}", the unnamed one)`;
  const nextStep = options.nextStep ?? ((name: CliTokenSourceName) => (name === DEFAULT_CLI_TOKEN_SOURCE_NAME ? `${cliName} auth show` : `${cliName} auth show --token-source ${name}`));

  const setCommand: CommandModule = {
    command: 'set <token-command>',
    describe: `Save a command that prints ${tokenDescription} (e.g. "${exampleCommand}"), optionally under a name`,
    builder: (yargs: Argv) => {
      const base = yargs.positional('token-command', { type: 'string', demandOption: true, describe: 'The command to run (quote it as one argument)' }).option('name', { type: 'string', describe: nameDescribe });
      const withOptions = options.setOptions ? options.setOptions(base) : base;
      const examples = options.setExamples ?? [
        [`$0 auth token-source set "${exampleCommand}"`, 'Use tokens minted by the app CLI'],
        [`$0 auth token-source set "${exampleCommand} --env prod" --name prod`, 'Save a named source for production']
      ];

      return withOptions.example(examples as [string, string][]);
    },
    handler: wrapCommandHandler(async (argv: any) => {
      const result = await setCliTokenSource(options, { command: String(argv.tokenCommand ?? ''), name: argv.name, options: argv });
      outputResult({ ...result, nextStep: nextStep(result.name) });
    })
  };

  const useCommand: CommandModule = {
    command: 'use <name>',
    describe: `Select the saved token source used when a run selects none ("${DEFAULT_CLI_TOKEN_SOURCE_NAME}" for the unnamed one)`,
    builder: (yargs: Argv) => yargs.positional('name', { type: 'string', demandOption: true, describe: 'The saved source to use' }).example([['$0 auth token-source use prod', 'Use the "prod" source unless a run selects another one']]),
    handler: wrapCommandHandler(async (argv: any) => {
      outputResult(await useCliTokenSource(options, String(argv.name ?? '')));
    })
  };

  const showCommand: CommandModule = {
    command: 'show',
    aliases: ['list'],
    describe: options.describe?.show ?? `List the saved token sources and show the one in effect (${envVarNames.tokenSource} / ${envVarNames.tokenCommand} included) and its cached token (never the token)`,
    builder: (yargs: Argv) => yargs,
    handler: wrapCommandHandler(async (argv: any) => {
      outputResult(await buildCliTokenSourceShowResult(options, cliTokenSourceSelectionFromArgv(argv)));
    })
  };

  const clearCommand: CommandModule = {
    command: 'clear',
    describe: options.describe?.clear ?? 'Remove a saved token source and its cached token',
    builder: (yargs: Argv) => yargs.option('name', { type: 'string', describe: nameDescribe }),
    handler: wrapCommandHandler(async (argv: any) => {
      outputResult(await clearCliTokenSource(options, { name: argv.name }));
    })
  };

  return {
    command: 'token-source',
    describe: options.describe?.tokenSource ?? `Use commands that mint access tokens, saved by name (per run: --token-source <name>, ${envVarNames.tokenSource}, ${envVarNames.tokenCommand})`,
    builder: (yargs: Argv) => yargs.command(setCommand).command(useCommand).command(showCommand).command(clearCommand).demandCommand(1, 'Please specify a token-source subcommand.'),
    handler: () => undefined
  };
}
