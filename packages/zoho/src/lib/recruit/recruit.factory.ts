import { fetchJsonFunction, fetchApiFetchService, ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { ZohoRecruitConfig, ZohoRecruitContext, ZohoRecruitContextRef, ZohoRecruitFetchFactory, ZohoRecruitFetchFactoryInput, zohoRecruitConfigApiUrl } from './recruit.config';
import { LogZohoServerErrorFunction } from '../zoho.error.api';
import { handleZohoRecruitErrorFetch, interceptZohoRecruit200StatusWithErrorResponse } from './recruit.error.api';
import { ZohoAccountsContextRef } from '../accounts/accounts.config';
import { zohoAccessTokenStringFactory } from '../accounts/accounts';
import { ZohoRateLimitedFetchHandlerConfig, zohoRateLimitedFetchHandler } from '../zoho.limit';
import { type Maybe } from '@dereekb/util';

export type ZohoRecruit = ZohoRecruitContextRef;

export interface ZohoRecruitFactoryConfig extends ZohoAccountsContextRef {
  /**
   * Custom ZohoRateLimitedFetchHandlerConfig
   */
  rateLimiterConfig?: Maybe<ZohoRateLimitedFetchHandlerConfig>;
  /**
   * Creates a new fetch instance to use when making calls.
   */
  fetchFactory?: ZohoRecruitFetchFactory;
  /**
   * Custom log error function.
   */
  logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

export type ZohoRecruitFactory = (config: ZohoRecruitConfig) => ZohoRecruit;

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

    const fetch: ConfiguredFetch = handleZohoRecruitErrorFetch(baseFetch, logZohoServerErrorFunction);
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
