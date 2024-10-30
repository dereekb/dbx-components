import { fetchJsonFunction, nodeFetchService, ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { ZohoRecruitConfig, ZohoRecruitContext, ZohoRecruitContextRef, ZohoRecruitFetchFactory, ZohoRecruitFetchFactoryInput, zohoRecruitConfigApiUrl } from './recruit.config';
import { LogZohoServerErrorFunction } from '../zoho.api.error';
import { handleZohoRecruitErrorFetch } from './recruit.error.api';
import { ZohoAccountsContextRef } from '../accounts/accounts.config';

export type ZohoRecruit = ZohoRecruitContextRef;

export interface ZohoRecruitFactoryConfig extends ZohoAccountsContextRef {
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
  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoRecruitFetchFactoryInput) =>
      nodeFetchService.makeFetch({
        baseUrl: input.apiUrl,
        baseRequest: {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${input.apiKey}`
          }
        },
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZohoRecruitConfig) => {
    if (!config.refreshToken) {
      throw new Error('ZohoConfig missing apiKey.');
    }

    const apiUrl = zohoRecruitConfigApiUrl(config.apiUrl ?? 'sandbox');
    const baseFetch = fetchFactory({ apiKey: config.refreshToken, apiUrl });

    const fetch: ConfiguredFetch = handleZohoRecruitErrorFetch(baseFetch, logZohoServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const recruitContext: ZohoRecruitContext = {
      fetch,
      fetchJson,
      config: {
        ...config,
        apiUrl
      }
    };

    const zohoRecruit: ZohoRecruit = {
      recruitContext
    };

    return zohoRecruit;
  };
}
