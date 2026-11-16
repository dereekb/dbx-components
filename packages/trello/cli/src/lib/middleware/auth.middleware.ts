import { type CliPaths, type CliTokenSource, CliError, cliTokenSourceSelectionFromArgv, createCliTokenSource, createContextSlot } from '@dereekb/dbx-cli';
import { type TrelloAccessTokenProvider, type TrelloConfig, type TrelloContext, type TrelloFactoryConfig, trelloFactory } from '@dereekb/trello';
import { type Maybe } from '@dereekb/util';
import type { Arguments } from 'yargs';
import { TRELLO_API_KEY_ENV_VAR, TRELLO_API_TOKEN_ENV_VAR, TRELLO_CLI_BOARD_ENV_VAR, TRELLO_CLI_NAME, type TrelloCliConfigFile, trelloCliConfigStore, trelloCliCredentialsStore, trelloCliPaths, trelloCliTokenSourceCommandConfig } from '../config/cli.config';
import { type TrelloCliAuthInfo, type TrelloCliCommandRequirement, type TrelloCliContext, createTrelloCliContext } from '../context/cli.context';
import { parseTrelloCliApiUrl, parseTrelloCliBoardArg } from '../util/option';
import { trelloCliStderrLogger } from '../util/output';

/**
 * The hint printed when no credentials are configured.
 */
export const TRELLO_CLI_NOT_CONFIGURED_SUGGESTION = `Run: ${TRELLO_CLI_NAME} auth login --key <key> --token <token> (key from https://trello.com/power-ups/admin), set ${TRELLO_API_KEY_ENV_VAR} + ${TRELLO_API_TOKEN_ENV_VAR}, or set a token source: ${TRELLO_CLI_NAME} auth token-source set "<app-cli> external-token trello"`;

/**
 * The global arguments the context resolution reads.
 */
export interface TrelloCliGlobalArgs {
  readonly tokenSource?: unknown;
  readonly board?: unknown;
  readonly apiUrl?: unknown;
  readonly verbose?: unknown;
}

/**
 * The credentials {@link resolveTrelloCliAuth} found, as a ready Trello context.
 */
export interface TrelloCliResolvedAuth {
  readonly trelloContext: TrelloContext;
  /**
   * The key + token context attachment downloads use, in `token-source` mode when a pair is configured.
   */
  readonly downloadTrelloContext?: Maybe<TrelloContext>;
  readonly auth: TrelloCliAuthInfo;
  /**
   * The token source minting the bearer token, in `token-source` mode.
   */
  readonly tokenSource?: Maybe<CliTokenSource>;
}

/**
 * Input for {@link resolveTrelloCliAuth}.
 */
export interface ResolveTrelloCliAuthInput {
  readonly argv?: Maybe<TrelloCliGlobalArgs>;
  /**
   * The environment to read. Defaults to `process.env`.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
  /**
   * The CLI's paths. Defaults to {@link trelloCliPaths} of `env`.
   */
  readonly paths?: Maybe<CliPaths>;
  /**
   * The already-loaded config file. Loaded from `paths` when omitted.
   */
  readonly configFile?: Maybe<TrelloCliConfigFile>;
  /**
   * Overrides the Trello client's fetch handler / rate limiter. Used by specs.
   */
  readonly trelloFactoryConfig?: Maybe<TrelloFactoryConfig>;
}

/**
 * A key + token pair found by {@link findTrelloCliKeyTokenPair}.
 */
interface TrelloCliKeyTokenPair {
  readonly config: TrelloConfig;
  readonly source: string;
}

/**
 * Finds a key + token pair: `TRELLO_API_KEY` + `TRELLO_API_TOKEN`, then the pair saved by `auth login`.
 *
 * @param env - The environment to read.
 * @param paths - The CLI's paths, locating the saved pair.
 * @param apiUrl - The `--api-url` override, if any.
 * @returns The pair as a Trello config plus where it came from, or undefined when none is configured.
 */
async function findTrelloCliKeyTokenPair(env: NodeJS.ProcessEnv, paths: CliPaths, apiUrl: Maybe<string>): Promise<Maybe<TrelloCliKeyTokenPair>> {
  const withApiUrl = apiUrl ? { apiUrl } : {};
  const envKey = env[TRELLO_API_KEY_ENV_VAR]?.trim();
  const envToken = env[TRELLO_API_TOKEN_ENV_VAR]?.trim();
  let result: Maybe<TrelloCliKeyTokenPair>;

  if (envKey && envToken) {
    result = { config: { apiKey: envKey, apiToken: envToken, ...withApiUrl }, source: `env (${TRELLO_API_KEY_ENV_VAR} + ${TRELLO_API_TOKEN_ENV_VAR})` };
  } else {
    const saved = await trelloCliCredentialsStore(paths).read();

    if (saved?.apiKey && saved.apiToken) {
      result = { config: { apiKey: saved.apiKey, apiToken: saved.apiToken, ...withApiUrl }, source: 'saved (auth login)' };
    }
  }

  return result;
}

/**
 * Resolves the run's credentials. The first match wins.
 *
 * 1. the active token source (`--token-source`, `TRELLO_CLI_TOKEN_SOURCE`, `TRELLO_CLI_TOKEN_COMMAND`, the saved
 *    selection): an OAuth bearer token minted by `<app-cli> external-token trello`. A 401 clears its cached token and
 *    retries once. Trello's attachment download endpoint refuses OAuth 2.0 tokens, so a key + token pair found as in
 *    step 2 is also picked up, for attachment downloads only (`downloadTrelloContext`).
 * 2. `TRELLO_API_KEY` + `TRELLO_API_TOKEN`, then the pair saved by `auth login` (`credentials.json`, mode 0600).
 *
 * @param input - The arguments, env, paths and client overrides.
 * @returns The Trello context and how it authenticated.
 * @throws {CliError} `NOT_CONFIGURED` when no credentials are found; `INVALID_ARGUMENT` for a bad `--api-url`.
 */
export async function resolveTrelloCliAuth(input: ResolveTrelloCliAuthInput = {}): Promise<TrelloCliResolvedAuth> {
  const env = input.env ?? process.env;
  const paths = input.paths ?? trelloCliPaths(env);
  const argv = input.argv ?? {};
  const { resolver, tokenCachePath } = trelloCliTokenSourceCommandConfig(paths, env);
  const configFile = input.configFile ?? (await trelloCliConfigStore(paths).loadConfigFile());
  const active = resolver.resolveActiveTokenSource(configFile, cliTokenSourceSelectionFromArgv(argv));
  const apiUrl = parseTrelloCliApiUrl(argv.apiUrl);
  const factory = trelloFactory({ logTrelloServerErrorFunction: trelloCliStderrLogger(argv.verbose === true), ...input.trelloFactoryConfig });
  const withApiUrl = apiUrl ? { apiUrl } : {};
  let result: TrelloCliResolvedAuth;

  if (active) {
    const tokenSource = createCliTokenSource({ command: active.command, tokenCachePath });
    const accessTokenProvider: TrelloAccessTokenProvider = Object.assign(
      async () => {
        const token = await tokenSource.loadToken();
        return { accessToken: token.accessToken, expiresAt: token.expiresAt ? new Date(token.expiresAt) : undefined };
      },
      { resetAccessToken: () => tokenSource.resetToken() }
    );
    const { trelloContext } = factory({ accessTokenProvider, ...withApiUrl });
    const downloadPair = await findTrelloCliKeyTokenPair(env, paths, apiUrl);
    result = {
      trelloContext,
      tokenSource,
      downloadTrelloContext: downloadPair ? factory(downloadPair.config).trelloContext : undefined,
      auth: { mode: 'token-source', source: `token-source ${resolver.originLabel(active)}`, downloadSource: downloadPair?.source }
    };
  } else {
    const pair = await findTrelloCliKeyTokenPair(env, paths, apiUrl);

    if (pair == null) {
      throw new CliError({ message: 'No Trello credentials are configured.', code: 'NOT_CONFIGURED', suggestion: TRELLO_CLI_NOT_CONFIGURED_SUGGESTION });
    }

    result = { trelloContext: factory(pair.config).trelloContext, auth: { mode: 'key-token', source: pair.source } };
  }

  return result;
}

/**
 * Input for {@link resolveTrelloCliBoard}.
 */
export interface ResolveTrelloCliBoardInput {
  readonly argv?: Maybe<TrelloCliGlobalArgs>;
  readonly configFile?: Maybe<TrelloCliConfigFile>;
  /**
   * The environment to read `TRELLO_CLI_BOARD` from. Defaults to `process.env`.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
}

/**
 * The board in effect: `--board`, then the config's `defaultBoard`, then `TRELLO_CLI_BOARD`.
 *
 * @param input - The arguments, config file and env.
 * @returns The board id or shortLink, or undefined.
 */
export function resolveTrelloCliBoard(input: ResolveTrelloCliBoardInput): Maybe<string> {
  const env = input.env ?? process.env;
  return parseTrelloCliBoardArg(input.argv?.board) ?? parseTrelloCliBoardArg(input.configFile?.defaultBoard) ?? parseTrelloCliBoardArg(env[TRELLO_CLI_BOARD_ENV_VAR]);
}

/**
 * What a command asks the {@link TrelloCliContextProvider} for.
 */
export interface TrelloCliContextRequest {
  readonly argv: Arguments;
  readonly requires: TrelloCliCommandRequirement;
  /**
   * The plugin whose command is running, which names its state directory. Unset for built-in commands.
   */
  readonly pluginName?: Maybe<string>;
}

/**
 * Builds the {@link TrelloCliContext} for a command. The stock CLI resolves credentials from flags, env and config; a
 * host-built CLI can pass its own to `runTrelloCli({ contextProvider })`.
 */
export type TrelloCliContextProvider = (request: TrelloCliContextRequest) => Promise<TrelloCliContext>;

/**
 * Config for {@link createTrelloCliContextProvider}.
 */
export interface CreateTrelloCliContextProviderConfig {
  /**
   * The environment to read. Defaults to `process.env`.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
  /**
   * Overrides the Trello client's fetch handler / rate limiter. Used by specs.
   */
  readonly trelloFactoryConfig?: Maybe<TrelloFactoryConfig>;
  readonly cliName?: Maybe<string>;
  readonly now?: Maybe<() => Date>;
}

/**
 * Creates the stock {@link TrelloCliContextProvider}: credentials from {@link resolveTrelloCliAuth}, the board from
 * {@link resolveTrelloCliBoard}.
 *
 * For a `requires: 'none'` command a missing credential is not an error: the context's `trelloContext` throws
 * `NOT_CONFIGURED` only if the command touches it.
 *
 * @param config - The env and client overrides.
 * @returns The provider.
 */
export function createTrelloCliContextProvider(config: CreateTrelloCliContextProviderConfig = {}): TrelloCliContextProvider {
  return async (request) => {
    const env = config.env ?? process.env;
    const paths = trelloCliPaths(env);
    const argv = request.argv as TrelloCliGlobalArgs;
    const configFile = await trelloCliConfigStore(paths).loadConfigFile();
    let resolved: Maybe<TrelloCliResolvedAuth>;
    let notConfiguredError: Maybe<Error>;

    try {
      resolved = await resolveTrelloCliAuth({ argv, env, paths, configFile, trelloFactoryConfig: config.trelloFactoryConfig });
    } catch (e) {
      if (request.requires !== 'none') {
        throw e;
      }

      notConfiguredError = e as Error;
    }

    const tokenSource = resolved?.tokenSource;

    return createTrelloCliContext({
      trelloContext: resolved?.trelloContext,
      downloadTrelloContext: resolved?.downloadTrelloContext,
      notConfiguredError,
      auth: resolved?.auth ?? { mode: 'none', source: 'none' },
      board: resolveTrelloCliBoard({ argv, configFile, env }),
      configDir: paths.configDir,
      stateName: request.pluginName,
      cliName: config.cliName,
      now: config.now,
      resetCredentials: tokenSource ? () => tokenSource.resetToken() : undefined
    });
  };
}

/**
 * The run's context provider, shared through a `Symbol.for` global so a plugin bundling its own copy of
 * `@dereekb/trello/cli` still sees the host's provider.
 */
const trelloCliContextProviderSlot = createContextSlot<TrelloCliContextProvider>({ globalKey: '@dereekb/trello/cli:contextProvider' });

/**
 * Contexts already resolved for an argv object, so repeated lookups in one run share one resolution.
 */
const resolvedTrelloCliContexts = new WeakMap<object, Map<string, Promise<TrelloCliContext>>>();

/**
 * Sets the provider {@link getTrelloCliContext} resolves through. `runTrelloCli` calls it; a library user composing
 * their own yargs program can too.
 *
 * @param provider - The provider, or undefined to fall back to the stock one.
 */
export function setTrelloCliContextProvider(provider: Maybe<TrelloCliContextProvider>): void {
  trelloCliContextProviderSlot.set(provider);
}

/**
 * Returns the {@link TrelloCliContext} for a run, resolved once per argv object through the provider `runTrelloCli`
 * set (or the stock provider).
 *
 * @param argv - The parsed arguments of the running command.
 * @param requires - What the command needs. Defaults to `trello`.
 * @param pluginName - The plugin running the command, which names its state directory.
 * @returns The context.
 */
export function getTrelloCliContext(argv: Arguments, requires: TrelloCliCommandRequirement = 'trello', pluginName?: Maybe<string>): Promise<TrelloCliContext> {
  const provider = trelloCliContextProviderSlot.get() ?? createTrelloCliContextProvider();
  const key = `${requires}:${pluginName ?? ''}`;
  let cache = resolvedTrelloCliContexts.get(argv);

  if (cache == null) {
    cache = new Map();
    resolvedTrelloCliContexts.set(argv, cache);
  }

  let promise = cache.get(key);

  if (promise == null) {
    promise = provider({ argv, requires, pluginName });
    cache.set(key, promise);
  }

  return promise;
}
