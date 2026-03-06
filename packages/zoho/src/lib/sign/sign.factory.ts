import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoSignConfig, type ZohoSignContext, type ZohoSignContextRef, type ZohoSignFetchFactory, type ZohoSignFetchFactoryInput, zohoSignConfigApiUrl } from './sign.config';
import { type LogZohoServerErrorFunction, ZohoInvalidTokenError } from '../zoho.error.api';
import { handleZohoSignErrorFetch, interceptZohoSign200StatusWithErrorResponse } from './sign.error.api';
import { type ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { type ZohoRateLimitedFetchHandlerConfig, zohoRateLimitedFetchHandler } from '../zoho.limit';
import { type Maybe } from '@dereekb/util';

export type ZohoSign = ZohoSignContextRef;

export interface ZohoSignFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom ZohoRateLimitedFetchHandlerConfig
   */
  rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Creates a new fetch instance to use when making calls.
   */
  fetchFactory?: ZohoSignFetchFactory;
  /**
   * Custom log error function.
   */
  logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

export type ZohoSignFactory = (config: ZohoSignConfig) => ZohoSign;

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
