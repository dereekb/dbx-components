import { type CliOutputConfig, type CliPaths, type CliTokenSourceCommandConfig, type CliTokenSourceConfig, type CliTokenSourceConfigFile, type CliTokenSourceJsonConfigStore, type CliTokenSourceResolver, buildCliPaths, cliTokenSourceJsonConfigStore, cliTokenSourceResolver, mergeOutputConfig } from '@dereekb/dbx-cli';
import { type Maybe } from '@dereekb/util';

/**
 * The binary name of the Microsoft Graph CLI. Derives its config directory (`~/.msgraph-cli`) and its
 * token-source env vars (`MSGRAPH_CLI_TOKEN_SOURCE`, `MSGRAPH_CLI_TOKEN_COMMAND`).
 */
export const MSGRAPH_CLI_NAME = 'msgraph-cli';

/**
 * Env var that replaces the config directory (`~/.msgraph-cli`), e.g. for an isolated test run.
 */
export const MSGRAPH_CLI_CONFIG_DIR_ENV_VAR = 'MSGRAPH_CLI_CONFIG_DIR';

/**
 * Env var that names the scopes to narrow the minted token to when `--scopes` is not passed.
 */
export const MSGRAPH_CLI_SCOPES_ENV_VAR = 'MSGRAPH_CLI_SCOPES';

/**
 * A saved msgraph-cli token source. It has only the shared `command`.
 */
export type MsGraphCliTokenSourceConfig = CliTokenSourceConfig;

/**
 * The msgraph-cli config file: the saved token sources and the output settings.
 */
export interface MsGraphCliConfigFile extends CliTokenSourceConfigFile<MsGraphCliTokenSourceConfig> {
  readonly output?: Maybe<CliOutputConfig>;
}

/**
 * Returns the msgraph-cli paths, honoring {@link MSGRAPH_CLI_CONFIG_DIR_ENV_VAR}.
 *
 * @param env - The environment to read the override from. Defaults to `process.env`.
 * @returns The CLI's config directory, config file, and token file.
 */
export function msGraphCliPaths(env: NodeJS.ProcessEnv = process.env): CliPaths {
  const configDirOverride = env[MSGRAPH_CLI_CONFIG_DIR_ENV_VAR]?.trim() || undefined;
  return buildCliPaths({ cliName: MSGRAPH_CLI_NAME, configDirOverride });
}

/**
 * Reads and writes the msgraph-cli config file.
 */
export type MsGraphCliConfigStore = CliTokenSourceJsonConfigStore<MsGraphCliTokenSourceConfig, MsGraphCliConfigFile>;

/**
 * Creates the {@link MsGraphCliConfigStore} over the config file at the given paths.
 *
 * @param paths - The CLI's paths. Defaults to {@link msGraphCliPaths}.
 * @returns The store.
 */
export function msGraphCliConfigStore(paths: Pick<CliPaths, 'configDir' | 'configFilePath'> = msGraphCliPaths()): MsGraphCliConfigStore {
  return cliTokenSourceJsonConfigStore<MsGraphCliTokenSourceConfig, MsGraphCliConfigFile>(paths);
}

/**
 * Merges an output-config update into the saved output config.
 *
 * @param update - The output settings to merge.
 * @param store - The config store. Defaults to {@link msGraphCliConfigStore}.
 * @returns The saved config.
 */
export async function mergeMsGraphCliOutputConfig(update: CliOutputConfig, store: MsGraphCliConfigStore = msGraphCliConfigStore()): Promise<Maybe<MsGraphCliConfigFile>> {
  const existing = await store.loadConfigFile();
  return store.updateConfigFile({ output: mergeOutputConfig(existing?.output, update) });
}

/**
 * Creates the msgraph-cli token-source selection rules (`--token-source`, `MSGRAPH_CLI_TOKEN_SOURCE`,
 * `MSGRAPH_CLI_TOKEN_COMMAND`, the saved selection).
 *
 * @param env - The environment to read the env vars from. Defaults to `process.env`.
 * @returns The resolver.
 */
export function msGraphCliTokenSourceResolver(env?: Maybe<NodeJS.ProcessEnv>): CliTokenSourceResolver<MsGraphCliTokenSourceConfig> {
  return cliTokenSourceResolver<MsGraphCliTokenSourceConfig>({ cliName: MSGRAPH_CLI_NAME, env });
}

/**
 * Builds the config the `auth token-source` commands and the auth middleware share.
 *
 * @param paths - The CLI's paths. Defaults to {@link msGraphCliPaths}.
 * @param env - The environment the resolver reads. Defaults to `process.env`.
 * @returns The token-source command config.
 */
export function msGraphCliTokenSourceCommandConfig(paths: CliPaths = msGraphCliPaths(), env?: Maybe<NodeJS.ProcessEnv>): CliTokenSourceCommandConfig<MsGraphCliTokenSourceConfig> {
  return { resolver: msGraphCliTokenSourceResolver(env), tokenCachePath: paths.tokenCachePath, ...msGraphCliConfigStore(paths) };
}

/**
 * Reads the scopes to narrow the minted token to: the `--scopes` flag, else {@link MSGRAPH_CLI_SCOPES_ENV_VAR}.
 *
 * Accepts space- or comma-separated scopes.
 *
 * @param argv - The parsed arguments.
 * @param env - The environment. Defaults to `process.env`.
 * @returns The scopes, or undefined when neither is set.
 */
export function msGraphCliScopesFromArgv(argv: Maybe<{ readonly scopes?: unknown }>, env: NodeJS.ProcessEnv = process.env): Maybe<string[]> {
  const raw = typeof argv?.scopes === 'string' && argv.scopes.trim() ? argv.scopes : env[MSGRAPH_CLI_SCOPES_ENV_VAR];
  const scopes = (raw ?? '').split(/[\s,]+/).filter(Boolean);
  return scopes.length > 0 ? scopes : undefined;
}
