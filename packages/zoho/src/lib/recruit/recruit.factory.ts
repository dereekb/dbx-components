import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoRecruitConfig, type ZohoRecruitContext, type ZohoRecruitContextRef, type ZohoRecruitFetchFactory, type ZohoRecruitFetchFactoryInput, zohoRecruitConfigApiUrl } from './recruit.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoRecruitErrorFetch, interceptZohoRecruit200StatusWithErrorResponse } from './recruit.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig, zohoRateLimitedFetchHandler } from '../zoho.limit';
import { type Maybe } from '@dereekb/util';

/**
 * Top-level Zoho Recruit client instance, providing access to the authenticated {@link ZohoRecruitContext}.
 */
export type ZohoRecruit = ZohoRecruitContextRef;

/**
 * Configuration for creating a {@link ZohoRecruitFactory}, combining account credentials
 * with optional overrides for rate limiting, fetch behavior, and error logging.
 */
export interface ZohoRecruitFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom rate limiter configuration to control request concurrency and throttling.
   */
  rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Custom fetch factory for creating the underlying HTTP client.
   * Defaults to a standard fetch service with OAuth Bearer token headers and a 20-second timeout.
   */
  fetchFactory?: ZohoRecruitFetchFactory;
  /**
   * Custom error logging function invoked when Zoho API errors are encountered.
   */
  logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that creates a {@link ZohoRecruit} client from a {@link ZohoRecruitConfig}.
 */
export type ZohoRecruitFactory = (config: ZohoRecruitConfig) => ZohoRecruit;

/**
 * Creates a {@link ZohoRecruitFactory} from the given configuration.
 *
 * The factory pre-initializes shared resources (access token provider, rate limiter)
 * once, then produces {@link ZohoRecruit} client instances for each {@link ZohoRecruitConfig}.
 * Each client handles OAuth token refresh on {@link ZohoInvalidTokenError}, rate limiting,
 * and Zoho Recruit's non-standard error responses (200 status with error body).
 *
 * @param factoryConfig - Configuration providing account credentials and optional overrides
 * @returns A factory function that creates authenticated Zoho Recruit clients
 *
 * @example
 * ```typescript
 * const factory = zohoRecruitFactory({
 *   accountsContext: zohoAccountsApi.accountsContext
 * });
 *
 * const zohoRecruit = factory({
 *   apiUrl: 'https://recruit.zoho.com'
 * });
 *
 * // Use the recruit context for API calls:
 * const { recruitContext } = zohoRecruit;
 * ```
 */
export function zohoRecruitFactory(factoryConfig: ZohoRecruitFactoryConfig): ZohoRecruitFactory {
  const { accountsContext } = factoryConfig;
  const accessTokenStringFactory = zohoAccessTokenStringFactory(accountsContext.loadAccessToken);
  const fetchHandler = zohoRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoRecruitFetchFactoryInput) =>
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

  return (config: ZohoRecruitConfig) => {
    if (!config.apiUrl) {
      throw new Error('ZohoConfig missing api url.');
    }

    const apiUrl = zohoRecruitConfigApiUrl(config.apiUrl);
    const baseFetch = fetchFactory({ apiUrl });

    const fetch: ConfiguredFetch = handleZohoRecruitErrorFetch(baseFetch, logZohoServerErrorFunction, (x) => {
      if (x instanceof ZohoInvalidTokenError) {
        accountsContext.loadAccessToken.resetAccessToken();
      }
    });

    const fetchJson = fetchJsonFunction(fetch, {
      interceptJsonResponse: interceptZohoRecruit200StatusWithErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const recruitContext: ZohoRecruitContext = {
      fetch,
      fetchJson,
      accessTokenStringFactory,
      config: {
        ...config,
        apiUrl
      },
      zohoRateLimiter: fetchHandler._rateLimiter
    };

    const zohoRecruit: ZohoRecruit = {
      recruitContext
    };

    return zohoRecruit;
  };
}
