import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoSignConfig, type ZohoSignContext, type ZohoSignContextRef, type ZohoSignFetchFactory, type ZohoSignFetchFactoryInput, zohoSignConfigApiUrl } from './sign.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoSignErrorFetch, interceptZohoSign200StatusWithErrorResponse } from './sign.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig, zohoRateLimitedFetchHandler } from '../zoho.limit';
import { type Maybe } from '@dereekb/util';

/**
 * Top-level Zoho Sign client instance, providing access to the authenticated {@link ZohoSignContext}.
 */
export type ZohoSign = ZohoSignContextRef;

/**
 * Configuration for creating a {@link ZohoSignFactory}, combining account credentials
 * with optional overrides for rate limiting, fetch behavior, and error logging.
 */
export interface ZohoSignFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom rate limiter configuration to control request concurrency and throttling.
   */
  rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Custom fetch factory for creating the underlying HTTP client.
   * Defaults to a standard fetch service with OAuth Bearer token headers and a 20-second timeout.
   */
  fetchFactory?: ZohoSignFetchFactory;
  /**
   * Custom error logging function invoked when Zoho API errors are encountered.
   */
  logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that creates a {@link ZohoSign} client from a {@link ZohoSignConfig}.
 */
export type ZohoSignFactory = (config: ZohoSignConfig) => ZohoSign;

/**
 * Creates a {@link ZohoSignFactory} from the given configuration.
 *
 * The factory pre-initializes shared resources (access token provider, rate limiter)
 * once, then produces {@link ZohoSign} client instances for each {@link ZohoSignConfig}.
 * Each client handles OAuth token refresh on {@link ZohoInvalidTokenError}, rate limiting,
 * and Zoho Sign's non-standard error responses (200 status with error body).
 *
 * @param factoryConfig - Configuration providing account credentials and optional overrides
 * @returns A factory function that creates authenticated Zoho Sign clients
 *
 * @example
 * ```typescript
 * const factory = zohoSignFactory({
 *   accountsContext: zohoAccountsApi.accountsContext
 * });
 *
 * const zohoSign = factory({
 *   apiUrl: 'https://sign.zoho.com'
 * });
 *
 * // Use the sign context for API calls:
 * const { signContext } = zohoSign;
 * ```
 */
export function zohoSignFactory(factoryConfig: ZohoSignFactoryConfig): ZohoSignFactory {
  const { accountsContext } = factoryConfig;
  const accessTokenStringFactory = zohoAccessTokenStringFactory(accountsContext.loadAccessToken);
  const fetchHandler = zohoRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoSignFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: input.apiUrl,
        baseRequest: async () => ({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await accessTokenStringFactory()}`
          }
        }),
        fetchHandler,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZohoSignConfig) => {
    if (!config.apiUrl) {
      throw new Error('ZohoConfig missing api url.');
    }

    const apiUrl = zohoSignConfigApiUrl(config.apiUrl);
    const baseFetch = fetchFactory({ apiUrl });

    const fetch: ConfiguredFetch = handleZohoSignErrorFetch(baseFetch, logZohoServerErrorFunction, (x) => {
      if (x instanceof ZohoInvalidTokenError) {
        accountsContext.loadAccessToken.resetAccessToken();
      }
    });

    const fetchJson = fetchJsonFunction(fetch, {
      interceptJsonResponse: interceptZohoSign200StatusWithErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const signContext: ZohoSignContext = {
      fetch,
      fetchJson,
      accessTokenStringFactory,
      config: {
        ...config,
        apiUrl
      },
      zohoRateLimiter: fetchHandler._rateLimiter
    };

    const zohoSign: ZohoSign = {
      signContext
    };

    return zohoSign;
  };
}
