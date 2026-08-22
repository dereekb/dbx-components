import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoAnalyticsConfig, type ZohoAnalyticsContext, type ZohoAnalyticsContextRef, type ZohoAnalyticsFetchFactory, type ZohoAnalyticsFetchFactoryParams, ZOHO_ANALYTICS_ORG_ID_HEADER, zohoAnalyticsConfigApiUrl } from './analytics.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoAnalyticsErrorFetch, interceptZohoAnalytics200StatusWithErrorResponse } from './analytics.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig } from '../zoho.limit';
import { zohoAnalyticsRateLimitedFetchHandler } from './analytics.limit';
import { type Maybe } from '@dereekb/util';

/**
 * Top-level Zoho Analytics client instance, providing access to the authenticated {@link ZohoAnalyticsContext}.
 */
export type ZohoAnalytics = ZohoAnalyticsContextRef;

/**
 * Configuration for creating a {@link ZohoAnalyticsFactory}, combining account credentials
 * with optional overrides for rate limiting, fetch behavior, and error logging.
 */
export interface ZohoAnalyticsFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom rate limiter configuration to control request concurrency and throttling.
   */
  readonly rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Custom fetch factory for creating the underlying HTTP client.
   * Defaults to a standard fetch service with the Zoho-oauthtoken authorization and
   * ZANALYTICS-ORGID headers and a 20-second timeout.
   */
  readonly fetchFactory?: ZohoAnalyticsFetchFactory;
  /**
   * Custom error logging function invoked when Zoho API errors are encountered.
   */
  readonly logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that creates a {@link ZohoAnalytics} client from a {@link ZohoAnalyticsConfig}.
 */
export type ZohoAnalyticsFactory = (config: ZohoAnalyticsConfig) => ZohoAnalytics;

/**
 * Creates a {@link ZohoAnalyticsFactory} from the given configuration.
 *
 * The factory pre-initializes shared resources (access token provider, rate limiter)
 * once, then produces {@link ZohoAnalytics} client instances for each {@link ZohoAnalyticsConfig}.
 * Each client handles OAuth token refresh on {@link ZohoInvalidTokenError}, rate limiting,
 * and Zoho Analytics' failure envelope returned with a 200 status.
 *
 * Two details differ from the other Zoho services:
 *
 * - Analytics authorizes with the `Zoho-oauthtoken` scheme rather than `Bearer`.
 * - The `ZANALYTICS-ORGID` header is only attached when the config carries an `orgId`, because
 *   `GET /orgs` is the bootstrap call that discovers it and is the one endpoint that does not
 *   require it.
 *
 * @param factoryConfig - Configuration providing account credentials and optional overrides.
 * @returns A factory function that creates authenticated Zoho Analytics clients.
 *
 * @see https://www.zoho.com/analytics/api/v2/api-specification.html
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zohoAnalyticsFactory(factoryConfig: ZohoAnalyticsFactoryConfig): ZohoAnalyticsFactory {
  const { accountsContext } = factoryConfig;
  const accessTokenStringFactory = zohoAccessTokenStringFactory(accountsContext.loadAccessToken);
  const fetchHandler = zohoAnalyticsRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoAnalyticsFetchFactoryParams) =>
      fetchApiFetchService.makeFetch({
        baseUrl: input.apiUrl,
        baseRequest: async () => ({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Zoho-oauthtoken ${await accessTokenStringFactory()}`,
            ...(input.orgId ? { [ZOHO_ANALYTICS_ORG_ID_HEADER]: input.orgId } : undefined)
          }
        }),
        fetchHandler,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZohoAnalyticsConfig) => {
    if (!config.apiUrl) {
      throw new Error('ZohoAnalyticsConfig missing api url.');
    }

    const apiUrl = zohoAnalyticsConfigApiUrl(config.apiUrl);
    const baseFetch = fetchFactory({ apiUrl, orgId: config.orgId });

    const fetch: ConfiguredFetch = handleZohoAnalyticsErrorFetch(baseFetch, logZohoServerErrorFunction, (x) => {
      if (x instanceof ZohoInvalidTokenError) {
        void accountsContext.loadAccessToken.resetAccessToken();
      }
    });

    const fetchJson = fetchJsonFunction(fetch, {
      interceptJsonResponse: interceptZohoAnalytics200StatusWithErrorResponse, // intercept the failure envelope returned with a 200 status
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const analyticsContext: ZohoAnalyticsContext = {
      fetch,
      fetchJson,
      accessTokenStringFactory,
      config: {
        ...config,
        apiUrl
      },
      zohoRateLimiter: fetchHandler._rateLimiter
    };

    const zohoAnalytics: ZohoAnalytics = {
      analyticsContext
    };

    return zohoAnalytics;
  };
}
