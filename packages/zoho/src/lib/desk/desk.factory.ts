import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoDeskConfig, type ZohoDeskContext, type ZohoDeskContextRef, type ZohoDeskFetchFactory, type ZohoDeskFetchFactoryParams, zohoDeskConfigApiUrl } from './desk.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoDeskErrorFetch, interceptZohoDesk200StatusWithErrorResponse } from './desk.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig } from '../zoho.limit';
import { zohoDeskRateLimitedFetchHandler } from './desk.limit';
import { type Maybe } from '@dereekb/util';

/**
 * Top-level Zoho Desk client instance, providing access to the authenticated {@link ZohoDeskContext}.
 */
export type ZohoDesk = ZohoDeskContextRef;

/**
 * Configuration for creating a {@link ZohoDeskFactory}, combining account credentials
 * with optional overrides for rate limiting, fetch behavior, and error logging.
 */
export interface ZohoDeskFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom rate limiter configuration to control request concurrency and throttling.
   */
  readonly rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Custom fetch factory for creating the underlying HTTP client.
   * Defaults to a standard fetch service with OAuth Bearer token and orgId headers and a 20-second timeout.
   */
  readonly fetchFactory?: ZohoDeskFetchFactory;
  /**
   * Custom error logging function invoked when Zoho API errors are encountered.
   */
  readonly logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that creates a {@link ZohoDesk} client from a {@link ZohoDeskConfig}.
 */
export type ZohoDeskFactory = (config: ZohoDeskConfig) => ZohoDesk;

/**
 * Creates a {@link ZohoDeskFactory} from the given configuration.
 *
 * The factory pre-initializes shared resources (access token provider, rate limiter)
 * once, then produces {@link ZohoDesk} client instances for each {@link ZohoDeskConfig}.
 * Each client handles OAuth token refresh on {@link ZohoInvalidTokenError}, rate limiting,
 * and Zoho Desk's non-standard error responses (200 status with error body).
 *
 * Unlike CRM/Recruit/Sign, the Desk API requires an `orgId` header on every request.
 * This is injected automatically from the config.
 *
 * @param factoryConfig - Configuration providing account credentials and optional overrides
 * @returns A factory function that creates authenticated Zoho Desk clients
 */
export function zohoDeskFactory(factoryConfig: ZohoDeskFactoryConfig): ZohoDeskFactory {
  const { accountsContext } = factoryConfig;
  const accessTokenStringFactory = zohoAccessTokenStringFactory(accountsContext.loadAccessToken);
  const fetchHandler = zohoDeskRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoDeskFetchFactoryParams) =>
      fetchApiFetchService.makeFetch({
        baseUrl: input.apiUrl,
        baseRequest: async () => ({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await accessTokenStringFactory()}`,
            orgId: input.orgId
          }
        }),
        fetchHandler,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZohoDeskConfig) => {
    if (!config.apiUrl) {
      throw new Error('ZohoDeskConfig missing api url.');
    }

    if (!config.orgId) {
      throw new Error('ZohoDeskConfig missing orgId.');
    }

    const apiUrl = zohoDeskConfigApiUrl(config.apiUrl);
    const baseFetch = fetchFactory({ apiUrl, orgId: config.orgId });

    const fetch: ConfiguredFetch = handleZohoDeskErrorFetch(baseFetch, logZohoServerErrorFunction, (x) => {
      if (x instanceof ZohoInvalidTokenError) {
        void accountsContext.loadAccessToken.resetAccessToken();
      }
    });

    const fetchJson = fetchJsonFunction(fetch, {
      interceptJsonResponse: interceptZohoDesk200StatusWithErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const deskContext: ZohoDeskContext = {
      fetch,
      fetchJson,
      accessTokenStringFactory,
      config: {
        ...config,
        apiUrl
      },
      zohoRateLimiter: fetchHandler._rateLimiter
    };

    const zohoDesk: ZohoDesk = {
      deskContext
    };

    return zohoDesk;
  };
}
