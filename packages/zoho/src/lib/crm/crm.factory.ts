import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoCrmConfig, type ZohoCrmContext, type ZohoCrmContextRef, type ZohoCrmFetchFactory, type ZohoCrmFetchFactoryParams, zohoCrmConfigApiUrl } from './crm.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoCrmErrorFetch, interceptZohoCrm200StatusWithErrorResponse } from './crm.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig, zohoRateLimitedFetchHandler } from '../zoho.limit';
import { type Maybe } from '@dereekb/util';

/**
 * Top-level Zoho CRM client instance, providing access to the authenticated {@link ZohoCrmContext}.
 */
export type ZohoCrm = ZohoCrmContextRef;

/**
 * Configuration for creating a {@link ZohoCrmFactory}, combining account credentials
 * with optional overrides for rate limiting, fetch behavior, and error logging.
 */
export interface ZohoCrmFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom rate limiter configuration to control request concurrency and throttling.
   */
  readonly rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Custom fetch factory for creating the underlying HTTP client.
   * Defaults to a standard fetch service with OAuth Bearer token headers and a 20-second timeout.
   */
  readonly fetchFactory?: ZohoCrmFetchFactory;
  /**
   * Custom error logging function invoked when Zoho API errors are encountered.
   */
  readonly logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that creates a {@link ZohoCrm} client from a {@link ZohoCrmConfig}.
 */
export type ZohoCrmFactory = (config: ZohoCrmConfig) => ZohoCrm;

/**
 * Creates a {@link ZohoCrmFactory} from the given configuration.
 *
 * The factory pre-initializes shared resources (access token provider, rate limiter)
 * once, then produces {@link ZohoCrm} client instances for each {@link ZohoCrmConfig}.
 * Each client handles OAuth token refresh on {@link ZohoInvalidTokenError}, rate limiting,
 * and Zoho CRM's non-standard error responses (200 status with error body).
 *
 * @param factoryConfig - Configuration providing account credentials and optional overrides
 * @returns A factory function that creates authenticated Zoho CRM clients
 *
 * @example
 * ```typescript
 * const factory = zohoCrmFactory({
 *   accountsContext: zohoAccountsApi.accountsContext
 * });
 *
 * const zohoCrm = factory({
 *   apiUrl: 'https://www.zohoapis.com/crm'
 * });
 *
 * // Use the CRM context for API calls:
 * const { crmContext } = zohoCrm;
 * ```
 */
export function zohoCrmFactory(factoryConfig: ZohoCrmFactoryConfig): ZohoCrmFactory {
  const { accountsContext } = factoryConfig;
  const accessTokenStringFactory = zohoAccessTokenStringFactory(accountsContext.loadAccessToken);
  const fetchHandler = zohoRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoCrmFetchFactoryParams) =>
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

  return (config: ZohoCrmConfig) => {
    if (!config.apiUrl) {
      throw new Error('ZohoConfig missing api url.');
    }

    const apiUrl = zohoCrmConfigApiUrl(config.apiUrl);
    const baseFetch = fetchFactory({ apiUrl });

    const fetch: ConfiguredFetch = handleZohoCrmErrorFetch(baseFetch, logZohoServerErrorFunction, (x) => {
      if (x instanceof ZohoInvalidTokenError) {
        accountsContext.loadAccessToken.resetAccessToken();
      }
    });

    const fetchJson = fetchJsonFunction(fetch, {
      interceptJsonResponse: interceptZohoCrm200StatusWithErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const crmContext: ZohoCrmContext = {
      fetch,
      fetchJson,
      accessTokenStringFactory,
      config: {
        ...config,
        apiUrl
      },
      zohoRateLimiter: fetchHandler._rateLimiter
    };

    const zohoCrm: ZohoCrm = {
      crmContext
    };

    return zohoCrm;
  };
}
