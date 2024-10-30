import { fetchJsonFunction, nodeFetchService, ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { ZohoAccountsConfig, ZohoAccountsContext, ZohoAccountsContextRef, ZohoAccountsFetchFactory, ZohoAccountsFetchFactoryInput, zohoAccountsConfigApiUrl } from './accounts.config';
import { LogZohoServerErrorFunction } from '../zoho.api.error';
import { handleZohoAccountsErrorFetch } from './accounts.error.api';
import { ZohoAccessTokenCache, ZohoAccessTokenFactory, ZohoAccessTokenRefresher } from './accounts.api';

export type ZohoAccounts = ZohoAccountsContextRef;

export interface ZohoAccountsFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  fetchFactory?: ZohoAccountsFetchFactory;
  /**
   * Custom log error function.
   */
  logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

export type ZohoAccountsFactory = (config: ZohoAccountsConfig) => ZohoAccounts;

export function zohoAccountsFactory(factoryConfig: ZohoAccountsFactoryConfig): ZohoAccountsFactory {
  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoAccountsFetchFactoryInput) =>
      nodeFetchService.makeFetch({
        baseUrl: input.apiUrl,
        baseRequest: {
          headers: {
            'Content-Type': 'application/json'
          }
        },
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZohoAccountsConfig) => {
    if (!config.refreshToken) {
      throw new Error('ZohoConfig missing refreshToken.');
    } else if (!config.accessTokenCache) {
      throw new Error('ZohoConfig missing accessTokenCache.');
    }

    const apiUrl = zohoAccountsConfigApiUrl(config.apiUrl ?? 'us');
    const baseFetch = fetchFactory({ apiUrl });

    const fetch: ConfiguredFetch = handleZohoAccountsErrorFetch(baseFetch, logZohoServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const tokenRefresher: ZohoAccessTokenRefresher = async () => {
      // TODO: ...
    };

    const accessToken: ZohoAccessTokenFactory = zohoAccountsZohoAccessTokenFactory({
      tokenRefresher,
      accessTokenCache: config.accessTokenCache
    });

    const accountsContext: ZohoAccountsContext = {
      fetch,
      fetchJson,
      accessToken,
      config: {
        ...config,
        apiUrl
      }
    };

    const zohoAccounts: ZohoAccounts = {
      accountsContext
    };

    return zohoAccounts;
  };
}

export interface ZohoAccountsZohoAccessTokenFactoryConfig {
  readonly tokenRefresher: ZohoAccessTokenRefresher;
  readonly accessTokenCache: ZohoAccessTokenCache;
}

export function zohoAccountsZohoAccessTokenFactory(config: ZohoAccountsZohoAccessTokenFactoryConfig): ZohoAccessTokenFactory {}
