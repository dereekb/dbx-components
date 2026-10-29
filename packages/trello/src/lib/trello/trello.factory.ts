import { type ConfiguredFetch, type FetchHandler, type FetchJsonFunction, fetchApiFetchService, fetchJsonFunction, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { MS_IN_MINUTE, type Maybe, type Milliseconds, type ResetPeriodPromiseRateLimiter } from '@dereekb/util';
import { handleTrelloErrorFetch, type LogTrelloServerErrorFunction, TrelloInvalidTokenError } from '../trello.error.api';
import { trelloRateLimitedFetchHandler, type TrelloRateLimitedFetchHandlerConfig } from '../trello.limit';
import { type TrelloBearerAccessToken, type TrelloConfig, isTrelloAccessTokenConfig, isTrelloAccessTokenProviderConfig, isTrelloApiKeyTokenConfig } from '../trello.config';
import { TRELLO_API_URL, TRELLO_OAUTH_API_URL } from '../trello.type';

/**
 * How long before its stated expiration a provider-mode access token is replaced, when the config does
 * not say. Matches the one-minute buffer the Zoho access-token factory uses.
 */
export const DEFAULT_TRELLO_ACCESS_TOKEN_EXPIRATION_BUFFER: Milliseconds = MS_IN_MINUTE;

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
  /**
   * Optional FetchHandler composed UNDER the rate limiter, standing in for the network call.
   *
   * The seam specs use to intercept requests before they leave the process. A response it returns still
   * goes through the timeout, the ok-check, the Trello error mapping and the 401 retry, so a spec
   * exercises the real header composition and failure handling. Its `makeFetch` argument is the global
   * fetch.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
}

export type TrelloFactory = (config: TrelloConfig) => Trello;

/**
 * Builds a Trello API factory.
 *
 * Three auth modes, picked by the {@link TrelloConfig} given:
 *
 * - key+token: Trello's `Authorization: OAuth oauth_consumer_key=..., oauth_token=...` header form, so
 *   credentials never appear in URLs or logs.
 * - `{ accessToken }`: a static OAuth 2.0 `Authorization: Bearer` token. A 401 throws.
 * - `{ accessTokenProvider }`: a bearer token from the provider, cached until it nears expiry. A 401
 *   clears the cache, awaits `accessTokenProvider.resetAccessToken`, and retries the request ONCE.
 *
 * @param factoryConfig - Factory-level configuration shared across created Trello instances.
 * @returns A factory function that creates a configured Trello API instance.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trelloFactory(factoryConfig: TrelloFactoryConfig = {}): TrelloFactory {
  const { logTrelloServerErrorFunction, fetchHandler: innerFetchHandler } = factoryConfig;
  const fetchHandler = trelloRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  // the inner handler replaces the network call itself, UNDER the rate limiter and the ok-check, so a
  // spec intercepting requests sees exactly what would have been sent and its responses are handled
  // exactly as real ones
  const makeFetch: Maybe<typeof fetch> = innerFetchHandler ? (((input: RequestInfo | URL, init?: RequestInit) => innerFetchHandler(new Request(input, init), fetch)) as typeof fetch) : undefined;

  return (config: TrelloConfig) => {
    const isLegacy = isTrelloApiKeyTokenConfig(config);
    let authorizationHeader: () => Promise<string>;
    let resetAccessToken: Maybe<() => Promise<void>>;

    if (isLegacy) {
      const authHeader = `OAuth oauth_consumer_key="${config.apiKey}", oauth_token="${config.apiToken}"`;
      authorizationHeader = async () => authHeader;
    } else if (isTrelloAccessTokenConfig(config)) {
      const authHeader = `Bearer ${config.accessToken}`;
      authorizationHeader = async () => authHeader;
    } else if (isTrelloAccessTokenProviderConfig(config)) {
      const { accessTokenProvider } = config;
      const expirationBuffer = config.accessTokenExpirationBuffer ?? DEFAULT_TRELLO_ACCESS_TOKEN_EXPIRATION_BUFFER;
      let cachedToken: Maybe<TrelloBearerAccessToken>;

      authorizationHeader = async () => {
        const now = Date.now();

        if (cachedToken == null || (cachedToken.expiresAt != null && cachedToken.expiresAt.getTime() - expirationBuffer <= now)) {
          cachedToken = await accessTokenProvider();
        }

        return `Bearer ${cachedToken.accessToken}`;
      };

      resetAccessToken = async () => {
        cachedToken = undefined;
        await accessTokenProvider.resetAccessToken?.();
      };
    } else {
      throw new Error('TrelloConfig requires apiKey + apiToken, accessToken, or accessTokenProvider.');
    }

    const baseFetch = fetchApiFetchService.makeFetch({
      baseUrl: config.apiUrl ?? (isLegacy ? TRELLO_API_URL : TRELLO_OAUTH_API_URL),
      baseRequest: async () => ({
        headers: {
          'Content-Type': 'application/json',
          Authorization: await authorizationHeader()
        }
      }),
      fetchHandler,
      ...(makeFetch ? { makeFetch } : undefined),
      timeout: 20 * 1000,
      requireOkResponse: true,
      useTimeout: true
    });

    const handledFetch: ConfiguredFetch = handleTrelloErrorFetch(baseFetch, logTrelloServerErrorFunction);
    const fetch: ConfiguredFetch = resetAccessToken
      ? async (input, init) => {
          let response: Response;

          try {
            response = await handledFetch(input, init);
          } catch (e) {
            if (e instanceof TrelloInvalidTokenError) {
              // a 401 means the request was not acted on, so one retry with a fresh token is safe. A
              // second 401 propagates.
              await (resetAccessToken as () => Promise<void>)();
              response = await handledFetch(input, init);
            } else {
              throw e;
            }
          }

          return response;
        }
      : handledFetch;

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
