import { type ConfiguredFetch, type FetchJsonFunction, fetchApiFetchService, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type Maybe, type ResetPeriodPromiseRateLimiter } from '@dereekb/util';
import { handleTrelloErrorFetch, type LogTrelloServerErrorFunction } from '../trello.error.api';
import { trelloRateLimitedFetchHandler, type TrelloRateLimitedFetchHandlerConfig } from '../trello.limit';
import { type TrelloConfig } from '../trello.config';
import { TRELLO_API_URL } from '../trello.type';

/**
 * A Trello context used for making authenticated requests to the Trello REST API.
 */
export interface TrelloContext {
  /**
   * Configured fetch that handles auth, rate limiting, and error normalization.
   */
  readonly fetch: ConfiguredFetch;
  /**
   * Convenience fetchJson wrapper.
   */
  readonly fetchJson: FetchJsonFunction;
  /**
   * The configuration this context was created with.
   */
  readonly config: TrelloConfig;
  /**
   * The underlying rate limiter used by the configured fetch.
   */
  readonly trelloRateLimiter: ResetPeriodPromiseRateLimiter;
}

export interface TrelloContextRef {
  readonly trelloContext: TrelloContext;
}

/**
 * A Trello API instance wrapping a {@link TrelloContext}.
 */
export type Trello = TrelloContextRef;

export interface TrelloFactoryConfig {
  /**
   * Optional rate limiter configuration override.
   */
  readonly rateLimiterConfig?: Maybe<TrelloRateLimitedFetchHandlerConfig>;
  /**
   * Optional custom error logger.
   */
  readonly logTrelloServerErrorFunction?: LogTrelloServerErrorFunction;
}

export type TrelloFactory = (config: TrelloConfig) => Trello;

/**
 * Builds a Trello API factory.
 *
 * Auth uses Trello's `Authorization: OAuth oauth_consumer_key=..., oauth_token=...` header form so credentials never appear in URLs or logs.
 *
 * @param factoryConfig Factory-level configuration shared across created Trello instances.
 * @returns A factory function that creates a configured Trello API instance.
 * @__NO_SIDE_EFFECTS__
 */
export function trelloFactory(factoryConfig: TrelloFactoryConfig = {}): TrelloFactory {
  const { logTrelloServerErrorFunction } = factoryConfig;
  const fetchHandler = trelloRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  return (config: TrelloConfig) => {
    const authHeader = `OAuth oauth_consumer_key="${config.apiKey}", oauth_token="${config.apiToken}"`;

    const baseFetch = fetchApiFetchService.makeFetch({
      baseUrl: config.apiUrl ?? TRELLO_API_URL,
      baseRequest: () => ({
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader
        }
      }),
      fetchHandler,
      timeout: 20 * 1000,
      requireOkResponse: true,
      useTimeout: true
    });

    const fetch: ConfiguredFetch = handleTrelloErrorFetch(baseFetch, logTrelloServerErrorFunction);
    const fetchJsonInst: FetchJsonFunction = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const trelloContext: TrelloContext = {
      fetch,
      fetchJson: fetchJsonInst,
      config,
      trelloRateLimiter: fetchHandler._rateLimiter
    };

    const trello: Trello = {
      trelloContext
    };

    return trello;
  };
}
