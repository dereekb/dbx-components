import {
  type CliJsonStore,
  type CliOutputConfig,
  type CliPaths,
  type CliPluginConfigEntry,
  type CliTokenSourceCommandConfig,
  type CliTokenSourceConfig,
  type CliTokenSourceConfigFile,
  type CliTokenSourceJsonConfigStore,
  type CliTokenSourceResolver,
  buildCliPaths,
  cliTokenSourceJsonConfigStore,
  cliTokenSourceResolver,
  createCliJsonStore,
  mergeOutputConfig
} from '@dereekb/dbx-cli';
import { type TrelloApiKey, type TrelloApiToken } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import { join } from 'node:path';

/**
 * The binary name of the Trello CLI. Derives its config directory (`~/.trello-cli`) and its token-source env vars
 * (`TRELLO_CLI_TOKEN_SOURCE`, `TRELLO_CLI_TOKEN_COMMAND`).
 */
export const TRELLO_CLI_NAME = 'trello-cli';

/**
 * The prefix of every trello-cli env var (`TRELLO_CLI_CONFIG_DIR`, `TRELLO_CLI_BOARD`, `TRELLO_CLI_EXTENSIONS`, …).
 */
export const TRELLO_CLI_ENV_PREFIX = 'TRELLO_CLI';

/**
 * Env var that replaces the config directory (`~/.trello-cli`), e.g. for an isolated test run.
 */
export const TRELLO_CLI_CONFIG_DIR_ENV_VAR = 'TRELLO_CLI_CONFIG_DIR';

/**
 * Env var naming the board to use when neither `--board` nor the config's `defaultBoard` is set.
 */
export const TRELLO_CLI_BOARD_ENV_VAR = 'TRELLO_CLI_BOARD';

/**
 * The Trello API key env var, read together with {@link TRELLO_API_TOKEN_ENV_VAR}. The same names `@dereekb/trello/nestjs`
 * reads, so a workspace `.env` configures both.
 */
export const TRELLO_API_KEY_ENV_VAR = 'TRELLO_API_KEY';

/**
 * The Trello API token env var, read together with {@link TRELLO_API_KEY_ENV_VAR}.
 */
export const TRELLO_API_TOKEN_ENV_VAR = 'TRELLO_API_TOKEN';

/**
 * The file (inside the config directory) holding a saved key+token pair. Written with mode 0600.
 */
export const TRELLO_CLI_CREDENTIALS_FILE_NAME = 'credentials.json';

/**
 * The directory (inside the config directory) holding per-plugin and core state, such as saved board snapshots.
 */
export const TRELLO_CLI_STATE_DIR_NAME = 'state';

/**
 * A saved trello-cli token source. It has only the shared `command`.
 */
export type TrelloCliTokenSourceConfig = CliTokenSourceConfig;

/**
 * The trello-cli config file: the saved token sources, the output settings, the default board and the plugins to load.
 */
export interface TrelloCliConfigFile extends CliTokenSourceConfigFile<TrelloCliTokenSourceConfig> {
  readonly output?: Maybe<CliOutputConfig>;
  /**
   * The board commands use when `--board` is not passed (`trello-cli config set default-board <id|shortLink|url>`).
   */
  readonly defaultBoard?: Maybe<string>;
  /**
   * Plugins to load on every run: a path (relative to the config directory), a package name (resolved from
   * `<configDir>/node_modules`, then from the CLI's install location), or `{ path, options }`.
   */
  readonly extensions?: Maybe<readonly CliPluginConfigEntry[]>;
}

/**
 * A key+token pair saved by `trello-cli auth login`.
 */
export interface TrelloCliSavedCredentials {
  readonly apiKey: TrelloApiKey;
  readonly apiToken: TrelloApiToken;
}

/**
 * Returns the trello-cli paths, honoring {@link TRELLO_CLI_CONFIG_DIR_ENV_VAR}.
 *
 * @param env - The environment to read the override from. Defaults to `process.env`.
 * @returns The CLI's config directory, config file, and token file.
 */
export function trelloCliPaths(env: NodeJS.ProcessEnv = process.env): CliPaths {
  const configDirOverride = env[TRELLO_CLI_CONFIG_DIR_ENV_VAR]?.trim() || undefined;
  return buildCliPaths({ cliName: TRELLO_CLI_NAME, configDirOverride });
}

/**
 * Reads and writes the trello-cli config file.
 */
export type TrelloCliConfigStore = CliTokenSourceJsonConfigStore<TrelloCliTokenSourceConfig, TrelloCliConfigFile>;

/**
 * Creates the {@link TrelloCliConfigStore} over the config file at the given paths.
 *
 * @param paths - The CLI's paths. Defaults to {@link trelloCliPaths}.
 * @returns The store.
 */
export function trelloCliConfigStore(paths: Pick<CliPaths, 'configDir' | 'configFilePath'> = trelloCliPaths()): TrelloCliConfigStore {
  return cliTokenSourceJsonConfigStore<TrelloCliTokenSourceConfig, TrelloCliConfigFile>(paths);
}

/**
 * Creates the store for the saved key+token pair (`<configDir>/credentials.json`, mode 0600).
 *
 * @param paths - The CLI's paths. Defaults to {@link trelloCliPaths}.
 * @returns The store.
 */
export function trelloCliCredentialsStore(paths: Pick<CliPaths, 'configDir'> = trelloCliPaths()): CliJsonStore<TrelloCliSavedCredentials> {
  return createCliJsonStore<TrelloCliSavedCredentials>({ filePath: join(paths.configDir, TRELLO_CLI_CREDENTIALS_FILE_NAME), mode: 0o600 });
}

/**
 * Merges an output-config update into the saved output config.
 *
 * @param update - The output settings to merge.
 * @param store - The config store. Defaults to {@link trelloCliConfigStore}.
 * @returns The saved config.
 */
export async function mergeTrelloCliOutputConfig(update: CliOutputConfig, store: TrelloCliConfigStore = trelloCliConfigStore()): Promise<Maybe<TrelloCliConfigFile>> {
  const existing = await store.loadConfigFile();
  return store.updateConfigFile({ output: mergeOutputConfig(existing?.output, update) });
}

/**
 * Creates the trello-cli token-source selection rules (`--token-source`, `TRELLO_CLI_TOKEN_SOURCE`,
 * `TRELLO_CLI_TOKEN_COMMAND`, the saved selection).
 *
 * @param env - The environment to read the env vars from. Defaults to `process.env`.
 * @returns The resolver.
 */
export function trelloCliTokenSourceResolver(env?: Maybe<NodeJS.ProcessEnv>): CliTokenSourceResolver<TrelloCliTokenSourceConfig> {
  return cliTokenSourceResolver<TrelloCliTokenSourceConfig>({ cliName: TRELLO_CLI_NAME, env });
}

/**
 * Builds the config the `auth token-source` commands and the auth resolution share.
 *
 * @param paths - The CLI's paths. Defaults to {@link trelloCliPaths}.
 * @param env - The environment the resolver reads. Defaults to `process.env`.
 * @returns The token-source command config.
 */
export function trelloCliTokenSourceCommandConfig(paths: CliPaths = trelloCliPaths(), env?: Maybe<NodeJS.ProcessEnv>): CliTokenSourceCommandConfig<TrelloCliTokenSourceConfig> {
  return { resolver: trelloCliTokenSourceResolver(env), tokenCachePath: paths.tokenCachePath, ...trelloCliConfigStore(paths) };
}
