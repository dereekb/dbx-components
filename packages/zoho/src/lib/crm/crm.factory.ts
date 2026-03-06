import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoCrmConfig, type ZohoCrmContext, type ZohoCrmContextRef, type ZohoCrmFetchFactory, type ZohoCrmFetchFactoryInput, zohoCrmConfigApiUrl } from './crm.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoCrmErrorFetch, interceptZohoCrm200StatusWithErrorResponse } from './crm.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig, zohoRateLimitedFetchHandler } from '../zoho.limit';
import { type Maybe } from '@dereekb/util';

/**
 * Main Zoho CRM instance providing access to all CRM API operations through its underlying context.
 */
export type ZohoCrm = ZohoCrmContextRef;

/**
 * Configuration for constructing a {@link ZohoCrmFactory}, including account credentials, rate limiting, and optional transport customization.
 */
export interface ZohoCrmFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom ZohoRateLimitedFetchHandlerConfig
   */
  rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Creates a new fetch instance to use when making calls.
   */
  fetchFactory?: ZohoCrmFetchFactory;
  /**
   * Custom log error function.
   */
  logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that produces a {@link ZohoCrm} instance from a given CRM configuration.
 */
export type ZohoCrmFactory = (config: ZohoCrmConfig) => ZohoCrm;

/**
 * Creates a {@link ZohoCrmFactory} that wires up authenticated fetch, rate limiting, error handling, and automatic token refresh for all downstream CRM API calls.
 */
export function zohoCrmFactory(factoryConfig: ZohoCrmFactoryConfig): ZohoCrmFactory {
  const { accountsContext } = factoryConfig;
  const accessTokenStringFactory = zohoAccessTokenStringFactory(accountsContext.loadAccessToken);
  const fetchHandler = zohoRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoCrmFetchFactoryInput) =>
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
