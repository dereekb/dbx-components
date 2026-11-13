import { CLI_EXIT_CODE_AUTH, CliError, cliTokenSourceSelectionFromArgv, createContextSlot, outputError, wrapCommandHandler } from '@dereekb/dbx-cli';
import { type MicrosoftGraphFactoryConfig } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import type { Arguments, MiddlewareFunction } from 'yargs';
import { MSGRAPH_CLI_NAME, msGraphCliPaths, msGraphCliTokenSourceCommandConfig } from '../config/cli.config';
import { createMsGraphCliContext, type MsGraphCliContext } from '../context/cli.context';
import { isMsGraphCliTokenRejectedError } from '../util/download.failure';

/**
 * Module-level context set by the auth middleware. Kept off argv so yargs strict mode does not reject it.
 */
const _cliContextSlot = createContextSlot<MsGraphCliContext>({
  notInitializedMessage: 'msgraph-cli context not initialized. This is a bug.'
});

/**
 * The hint printed when no token source is configured.
 */
export const MSGRAPH_CLI_NO_TOKEN_SOURCE_HINT = `Run: ${MSGRAPH_CLI_NAME} auth token-source set "<app-cli> external-token microsoft --env <preset>" (e.g. "demo-cli external-token microsoft --env msgraph-read")`;

/**
 * The global arguments the auth middleware reads.
 */
export interface MsGraphCliAuthArgs {
  readonly tokenSource?: unknown;
}

/**
 * Options for {@link createMsGraphCliAuthMiddleware}.
 */
export interface CreateMsGraphCliAuthMiddlewareConfig {
  /**
   * Top-level commands that run without a token source (e.g. `auth`, `output`).
   */
  readonly skipCommands: ReadonlySet<string>;
  /**
   * The environment to read the config dir and token-source env vars from. Defaults to `process.env`.
   */
  readonly env?: Maybe<NodeJS.ProcessEnv>;
  /**
   * Overrides the Graph client's fetch handler / base URL. Used by specs.
   */
  readonly graphFactoryConfig?: Maybe<MicrosoftGraphFactoryConfig>;
}

/**
 * Resolves the {@link MsGraphCliContext} for a run: the active token source (`--token-source`,
 * `MSGRAPH_CLI_TOKEN_SOURCE`, `MSGRAPH_CLI_TOKEN_COMMAND`, the saved selection).
 *
 * msgraph-cli authenticates ONLY through a token source; there is no `auth login`.
 *
 * @param argv - The parsed arguments (`tokenSource`).
 * @param config - The env and Graph client overrides.
 * @returns The context.
 * @throws {CliError} `NOT_CONFIGURED` when no token source is active.
 */
export async function resolveMsGraphCliContext(argv: Maybe<MsGraphCliAuthArgs>, config?: Maybe<Pick<CreateMsGraphCliAuthMiddlewareConfig, 'env' | 'graphFactoryConfig'>>): Promise<MsGraphCliContext> {
  const env = config?.env ?? process.env;
  const paths = msGraphCliPaths(env);
  const { resolver, loadConfigFile, tokenCachePath } = msGraphCliTokenSourceCommandConfig(paths, env);
  const active = resolver.resolveActiveTokenSource(await loadConfigFile(), cliTokenSourceSelectionFromArgv(argv));

  if (!active) {
    throw new CliError({ message: 'No token source is configured.', code: 'NOT_CONFIGURED', suggestion: MSGRAPH_CLI_NO_TOKEN_SOURCE_HINT });
  }

  return createMsGraphCliContext({ active, tokenCachePath, graphFactoryConfig: config?.graphFactoryConfig });
}

/**
 * Builds the yargs middleware that resolves the {@link MsGraphCliContext} for every command outside
 * `skipCommands`. On failure it prints the error envelope and exits with code 4.
 *
 * @param config - The commands to skip, the env, and the Graph client overrides.
 * @returns The middleware.
 */
export function createMsGraphCliAuthMiddleware(config: CreateMsGraphCliAuthMiddlewareConfig): MiddlewareFunction {
  return async (argv: Arguments) => {
    const command = argv._?.[0];

    if (typeof command !== 'string' || !config.skipCommands.has(command)) {
      try {
        _cliContextSlot.set(await resolveMsGraphCliContext(argv as MsGraphCliAuthArgs, config));
      } catch (e) {
        outputError(e);
        process.exit(CLI_EXIT_CODE_AUTH);
      }
    }
  };
}

/**
 * Returns the {@link MsGraphCliContext} the auth middleware resolved.
 *
 * @returns The context.
 * @throws {Error} When the middleware has not run (a wiring bug).
 */
export function getMsGraphCliContext(): MsGraphCliContext {
  return _cliContextSlot.require();
}

/**
 * Wraps a Graph command handler with {@link wrapCommandHandler}, clearing the token source's cached token
 * when Graph rejects it (401) so the next run mints a fresh one.
 *
 * @param handler - The command handler, given the run's context.
 * @returns The yargs handler.
 */
export function msGraphCommandHandler<T>(handler: (argv: Arguments<T>, context: MsGraphCliContext) => Promise<void>): (argv: Arguments<T>) => Promise<void> {
  return wrapCommandHandler<T>(async (argv) => {
    const context = getMsGraphCliContext();

    try {
      await handler(argv, context);
    } catch (e) {
      if (isMsGraphCliTokenRejectedError(e)) {
        await context.tokenSource.resetToken().catch(() => undefined);
      }

      throw e;
    }
  });
}
