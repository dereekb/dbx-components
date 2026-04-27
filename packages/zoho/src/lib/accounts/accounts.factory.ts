import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZohoAccountsConfig, type ZohoAccountsContext, type ZohoAccountsContextRef, type ZohoAccountsFetchFactory, type ZohoAccountsFetchFactoryParams, zohoAccountsConfigApiUrl } from './accounts.config';
import { type LogZohoServerErrorFunction } from '../zoho.error.api';
import { ZohoAccountsAuthFailureError, handleZohoAccountsErrorFetch, interceptZohoAccounts200StatusWithErrorResponse } from './accounts.error.api';
import { type ZohoAccessToken, type ZohoAccessTokenCache, type ZohoAccessTokenFactory, type ZohoAccessTokenRefresher } from './accounts';
import { MS_IN_MINUTE, MS_IN_SECOND, type Maybe, type Milliseconds } from '@dereekb/util';
import { zohoAccountsAccessToken } from './accounts.api';
import { zohoRateLimitedFetchHandler } from '../zoho.limit';

/**
 * Top-level Zoho Accounts client instance, providing access to the authenticated {@link ZohoAccountsContext}
 * used for OAuth token management.
 */
export type ZohoAccounts = ZohoAccountsContextRef;

/**
 * Configuration for creating a {@link ZohoAccountsFactory}, with optional overrides
 * for the HTTP client and error logging.
 */
export interface ZohoAccountsFactoryConfig {
  /**
   * Custom fetch factory for creating the underlying HTTP client.
   * Defaults to a standard fetch service with JSON content headers and a 20-second timeout.
   */
  readonly fetchFactory?: ZohoAccountsFetchFactory;
  /**
   * Custom error logging function invoked when Zoho API errors are encountered.
   */
  readonly logZohoServerErrorFunction?: LogZohoServerErrorFunction;
}

/**
 * Factory function that creates a {@link ZohoAccounts} client from a {@link ZohoAccountsConfig}.
 */
export type ZohoAccountsFactory = (config: ZohoAccountsConfig) => ZohoAccounts;

/**
 * Creates a {@link ZohoAccountsFactory} from the given configuration.
 *
 * The factory pre-initializes shared resources (rate limiter) once, then produces
 * {@link ZohoAccounts} client instances for each {@link ZohoAccountsConfig}. Each client
 * handles OAuth token refresh via the configured `refreshToken`, `clientId`, and `clientSecret`,
 * with in-memory caching and optional external {@link ZohoAccessTokenCache} support.
 *
 * The Accounts client is the foundation for CRM, Recruit, and Sign clients, as it provides
 * the {@link ZohoAccountsContext} needed for OAuth token management.
 *
 * @param factoryConfig - Configuration providing optional fetch and logging overrides
 * @returns A factory function that creates authenticated Zoho Accounts clients
 * @throws {Error} If `refreshToken`, `clientId`, or `clientSecret` are missing from the config
 *
 * @example
 * ```typescript
 * const factory = zohoAccountsFactory({});
 *
 * const zohoAccounts = factory({
 *   refreshToken: 'your-refresh-token',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   apiUrl: 'us'
 * });
 *
 * // Pass the accounts context to CRM/Recruit/Sign factories:
 * const crmFactory = zohoCrmFactory({
 *   accountsContext: zohoAccounts.accountsContext
 * });
 * ```
 */
export function zohoAccountsFactory(factoryConfig: ZohoAccountsFactoryConfig): ZohoAccountsFactory {
  const fetchHandler = zohoRateLimitedFetchHandler();

  const {
    logZohoServerErrorFunction,
    fetchFactory = (input: ZohoAccountsFetchFactoryParams) =>
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
      interceptJsonResponse: interceptZohoAccounts200StatusWithErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    const tokenRefresher: ZohoAccessTokenRefresher = async () => {
      const createdAt = Date.now();
      const { access_token, api_domain, scope, expires_in } = await zohoAccountsAccessToken(accountsContext)();

      const result: ZohoAccessToken = {
        accessToken: access_token,
        apiDomain: api_domain,
        expiresIn: expires_in,
        expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
        scope
      };

      return result;
    };

    tokenRefresher.resetAccessToken = async () => {
      return config.accessTokenCache?.clearCachedToken();
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

/**
 * Configuration for {@link zohoAccountsZohoAccessTokenFactory}, controlling token refresh,
 * caching, and expiration buffer behavior.
 */
export interface ZohoAccountsZohoAccessTokenFactoryConfig {
  /**
   * Number of milliseconds before the expiration time a token should be discarded
   * and refreshed proactively.
   *
   * Defaults to 1 minute.
   */
  readonly tokenExpirationBuffer?: Milliseconds;
  /**
   * Function that fetches a fresh access token from the Zoho OAuth endpoint.
   */
  readonly tokenRefresher: ZohoAccessTokenRefresher;
  /**
   * Optional external cache for persisting tokens across process restarts.
   * When provided, tokens are loaded from and saved to this cache in addition
   * to the in-memory cache.
   */
  readonly accessTokenCache?: Maybe<ZohoAccessTokenCache>;
}

/**
 * Creates a {@link ZohoAccessTokenFactory} that manages access token lifecycle with
 * in-memory caching, optional external cache support, and automatic refresh.
 *
 * Token resolution order:
 * 1. Return the in-memory cached token if valid (not expired within the buffer)
 * 2. Load from the external {@link ZohoAccessTokenCache} if available
 * 3. Fetch a fresh token via the {@link ZohoAccessTokenRefresher}
 *
 * The returned function also exposes a `resetAccessToken()` method to invalidate
 * the current cached token, typically called on {@link ZohoInvalidTokenError}.
 *
 * @param config - Token refresh, caching, and expiration buffer configuration
 * @returns A token factory function with `resetAccessToken` for cache invalidation
 * @throws {ZohoAccountsAuthFailureError} If the token refresher fails
 */
export function zohoAccountsZohoAccessTokenFactory(config: ZohoAccountsZohoAccessTokenFactoryConfig): ZohoAccessTokenFactory {
  const { tokenRefresher, accessTokenCache, tokenExpirationBuffer: inputTokenExpirationBuffer } = config;
  const tokenExpirationBuffer = inputTokenExpirationBuffer ?? MS_IN_MINUTE;

  /**
   * Caches the token internally here until it expires.
   */
  let currentToken: Maybe<ZohoAccessToken> = null;

  const resetAccessToken = async () => {
    currentToken = null;
  };

  const fn = async () => {
    // load from cache
    if (!currentToken) {
      const cachedToken = await accessTokenCache?.loadCachedToken();

      if (cachedToken) {
        currentToken = cachedToken;
      }
    }

    // check expiration
    if (currentToken != null) {
      const isExpired = Date.now() + tokenExpirationBuffer >= currentToken.expiresAt.getTime();

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

      try {
        await accessTokenCache?.updateCachedToken(currentToken);
      } catch {
        // do nothing
      }
    }

    return currentToken;
  };

  fn.resetAccessToken = resetAccessToken;

  return fn;
}
