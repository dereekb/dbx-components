import { type CliActiveTokenSource, type CliTokenSource, createCliTokenSource } from '@dereekb/dbx-cli';
import { type MicrosoftGraphContext, type MicrosoftGraphFactoryConfig, type MicrosoftGraphRateLimitedFetchHandlerConfig, type MicrosoftGraphThrottleDetails, microsoftGraphFactory } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { type MsGraphCliTokenSourceConfig } from '../config/cli.config';

/**
 * Everything a msgraph-cli command needs: the active token source and a Graph context authenticated by it.
 */
export interface MsGraphCliContext {
  /**
   * The token source in effect for the run, and where it was selected.
   */
  readonly active: CliActiveTokenSource<MsGraphCliTokenSourceConfig>;
  /**
   * The source minting the Graph access tokens.
   */
  readonly tokenSource: CliTokenSource;
  readonly graphContext: MicrosoftGraphContext;
}

/**
 * Config for {@link createMsGraphCliContext}.
 */
export interface CreateMsGraphCliContextConfig {
  readonly active: CliActiveTokenSource<MsGraphCliTokenSourceConfig>;
  /**
   * The CLI's token file, where minted tokens are cached per command.
   */
  readonly tokenCachePath: string;
  /**
   * Overrides the Graph client's fetch handler / base URL / throttle handling. Used by specs to intercept requests.
   */
  readonly graphFactoryConfig?: Maybe<MicrosoftGraphFactoryConfig>;
}

/**
 * Formats the stderr line msgraph-cli prints when Graph throttles a request. It carries the status and the wait
 * only, never the request.
 *
 * @param details - The throttle.
 * @returns The line, without a trailing newline.
 */
export function msGraphCliThrottledLine(details: MicrosoftGraphThrottleDetails): string {
  const seconds = Math.ceil(details.wait / 1000);
  return details.retrying ? `msgraph-cli: throttled by Microsoft Graph (${details.status}); waiting ${seconds} s` : `msgraph-cli: throttled by Microsoft Graph (${details.status}); not retrying (asked to wait ${seconds} s)`;
}

/**
 * The throttle handling msgraph-cli turns on for its Graph client: the library defaults (3 retries, a 60 s
 * longest wait), and a stderr line on each throttle.
 */
export const MSGRAPH_CLI_GRAPH_RATE_LIMITER_CONFIG: MicrosoftGraphRateLimitedFetchHandlerConfig = {
  onThrottled: (details) => process.stderr.write(`${msGraphCliThrottledLine(details)}\n`)
};

/**
 * Creates the {@link MsGraphCliContext} for a run: a token source for the active source's command, and a
 * Graph context that loads its bearer token from that source on each request.
 *
 * @param config - The active source, the token file, and the Graph client overrides.
 * @returns The context.
 *
 * @example
 * ```typescript
 * const context = createMsGraphCliContext({ active, tokenCachePath });
 * const me = await microsoftGraphRequest(context.graphContext)({ method: 'GET', path: '/me' });
 * ```
 */
export function createMsGraphCliContext(config: CreateMsGraphCliContextConfig): MsGraphCliContext {
  const { active, tokenCachePath } = config;
  const tokenSource = createCliTokenSource({ command: active.command, tokenCachePath });
  const { graphContext } = microsoftGraphFactory({ rateLimiterConfig: MSGRAPH_CLI_GRAPH_RATE_LIMITER_CONFIG, ...config.graphFactoryConfig })({ accessTokenGetter: async () => (await tokenSource.loadToken()).accessToken });
  return { active, tokenSource, graphContext };
}
