import { fetchJsonFunction, fetchApiFetchService, ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { ZohoAccountsConfig, ZohoAccountsContext, ZohoAccountsContextRef, ZohoAccountsFetchFactory, ZohoAccountsFetchFactoryInput, zohoAccountsConfigApiUrl } from './accounts.config';
import { LogZohoServerErrorFunction } from '../zoho.error.api';
import { ZohoAccountsAuthFailureError, handleZohoAccountsErrorFetch, interceptZohoAccountsErrorResponse } from './accounts.error.api';
import { ZohoAccessToken, ZohoAccessTokenCache, ZohoAccessTokenFactory, ZohoAccessTokenRefresher } from './accounts';
import { MS_IN_MINUTE, MS_IN_SECOND, Maybe, Milliseconds } from '@dereekb/util';
import { accessToken } from './accounts.api';
import { zohoRateLimitedFetchHandler } from '../zoho.limit';

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
  const fetchHandler = zohoRateLimitedFetchHandler();

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoAccountsFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: input.apiUrl,
        baseRequest: {
          headers: {
            'Content-Type': 'application/json'
          }
        },
        fetchHandler,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZohoAccountsConfig) => {
    if (!config.refreshToken) {
      throw new Error('ZohoAccountsConfig missing refreshToken.');
    } else if (!config.clientId) {
      throw new Error('ZohoAccountsConfig missing clientId.');
    } else if (!config.clientSecret) {
      throw new Error('ZohoAccountsConfig missing clientSecret.');
    }

    const apiUrl = zohoAccountsConfigApiUrl(config.apiUrl ?? 'us');
    const baseFetch = fetchFactory({ apiUrl });

    const fetch: ConfiguredFetch = handleZohoAccountsErrorFetch(baseFetch, logZohoServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      interceptJsonResponse: interceptZohoAccountsErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const tokenRefresher: ZohoAccessTokenRefresher = async () => {
      const createdAt = new Date().getTime();
      const { access_token, api_domain, scope, expires_in } = await accessToken(accountsContext)();

      const result: ZohoAccessToken = {
        accessToken: access_token,
        apiDomain: api_domain,
        expiresIn: expires_in,
        expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
        scope
      };

      return result;
    };

    const loadAccessToken: ZohoAccessTokenFactory = zohoAccountsZohoAccessTokenFactory({
      tokenRefresher,
      accessTokenCache: config.accessTokenCache
    });

    const accountsContext: ZohoAccountsContext = {
      fetch,
      fetchJson,
      loadAccessToken,
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
  /**
   * Number of milliseconds before the expiration time a token should be discarded.
   *
   * Defaults to 1 minute.
   */
  readonly tokenExpirationBuffer?: Milliseconds;
  readonly tokenRefresher: ZohoAccessTokenRefresher;
  readonly accessTokenCache?: Maybe<ZohoAccessTokenCache>;
}

/**
 * Creates a ZohoAccountsZohoAccessTokenFactoryConfig
 *
 * @param config
 * @returns
 */
export function zohoAccountsZohoAccessTokenFactory(config: ZohoAccountsZohoAccessTokenFactoryConfig): ZohoAccessTokenFactory {
  const { tokenRefresher, accessTokenCache, tokenExpirationBuffer: inputTokenExpirationBuffer } = config;
  const tokenExpirationBuffer = inputTokenExpirationBuffer ?? MS_IN_MINUTE;

  /**
   * Caches the token internally here until it expires.
   */
  let currentToken: Maybe<ZohoAccessToken> = null;

  return async () => {
    // load from cache
    if (!currentToken) {
      const cachedToken = await accessTokenCache?.loadCachedToken();

      if (cachedToken) {
        currentToken = cachedToken;
      }
    }

    // check expiration
    if (currentToken != null) {
      const isExpired = new Date().getTime() + tokenExpirationBuffer >= currentToken.expiresAt.getTime();

      if (isExpired) {
        currentToken = null;
      }
    }

    // load from source
    if (!currentToken) {
      try {
        currentToken = await tokenRefresher();
      } catch (e) {
        console.error(`zohoAccountsZohoAccessTokenFactory(): Failed retrieving new token from tokenRefresher: `, e);
        throw new ZohoAccountsAuthFailureError('Token Refresh Failed');
      }

      if (currentToken) {
        try {
          await accessTokenCache?.updateCachedToken(currentToken);
        } catch (e) {
          // do nothing
        }
      }
    }

    return currentToken;
  };
}
