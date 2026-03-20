import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { CALCOM_OAUTH_TOKEN_URL, type CalcomOAuthConfig, type CalcomOAuthContext, type CalcomOAuthContextRef, type CalcomOAuthFetchFactory, type CalcomOAuthFetchFactoryInput, type CalcomOAuthMakeUserAccessTokenFactory, type CalcomOAuthMakeUserAccessTokenFactoryInput } from './oauth.config';
import { type LogCalcomServerErrorFunction } from '../calcom.error.api';
import { CalcomOAuthAuthFailureError, handleCalcomOAuthErrorFetch } from './oauth.error.api';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomAccessTokenFactory, type CalcomAccessTokenRefresher } from './oauth';
import { MS_IN_MINUTE, MS_IN_SECOND, type Maybe, type Milliseconds } from '@dereekb/util';
import { calcomRateLimitedFetchHandler } from '../calcom.limit';
import { refreshAccessToken, type CalcomOAuthTokenResponse } from './oauth.api';

export type CalcomOAuth = CalcomOAuthContextRef;

export interface CalcomOAuthFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  fetchFactory?: CalcomOAuthFetchFactory;
  /**
   * Custom log error function.
   */
  logCalcomServerErrorFunction?: LogCalcomServerErrorFunction;
}

export type CalcomOAuthFactory = (config: CalcomOAuthConfig) => CalcomOAuth;

/**
 * Creates a {@link CalcomOAuthFactory} that produces configured Cal.com OAuth instances.
 * Supports both API key authentication (static token, no refresh) and full OAuth
 * refresh token flow with automatic token rotation.
 *
 * @param factoryConfig - configuration including optional fetch factory and error logging
 * @returns a factory function that accepts a CalcomOAuthConfig and produces a CalcomOAuth instance
 */
export function calcomOAuthFactory(factoryConfig: CalcomOAuthFactoryConfig): CalcomOAuthFactory {
  const fetchHandler = calcomRateLimitedFetchHandler();

  const {
    logCalcomServerErrorFunction,
    fetchFactory = (_?: CalcomOAuthFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: CALCOM_OAUTH_TOKEN_URL,
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

  return (config: CalcomOAuthConfig) => {
    const useApiKey = !!config.apiKey;

    if (!useApiKey) {
      if (!config.clientId) {
        throw new Error('CalcomOAuthConfig missing clientId. Provide clientId+clientSecret for OAuth or apiKey for API key auth.');
      } else if (!config.clientSecret) {
        throw new Error('CalcomOAuthConfig missing clientSecret.');
      }
    }

    const baseFetch = fetchFactory();

    const fetch: ConfiguredFetch = handleCalcomOAuthErrorFetch(baseFetch, logCalcomServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    // MARK: API Key Auth (static token, no refresh)
    if (useApiKey) {
      const apiKeyToken: CalcomAccessToken = {
        accessToken: config.apiKey as string,
        refreshToken: '',
        expiresIn: Number.MAX_SAFE_INTEGER,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100), // 100 years
        scope: ''
      };

      const loadAccessToken: CalcomAccessTokenFactory = async () => apiKeyToken;

      const makeUserAccessTokenFactory: CalcomOAuthMakeUserAccessTokenFactory = () => {
        throw new Error('makeUserAccessTokenFactory is not available when using API key auth. Use OAuth for per-user contexts.');
      };

      const oauthContext: CalcomOAuthContext = {
        fetch,
        fetchJson,
        loadAccessToken,
        makeUserAccessTokenFactory,
        config
      };

      return { oauthContext } as CalcomOAuth;
    }

    // MARK: OAuth Auth (refresh token flow)
    /**
     * Tracks the latest refresh token since Cal.com rotates them.
     */
    let latestRefreshToken = config.refreshToken;

    function accessTokenFromTokenResponse(result: CalcomOAuthTokenResponse): CalcomAccessToken {
      const createdAt = new Date().getTime();
      const { access_token, refresh_token, scope, expires_in } = result;

      // Store the new refresh token for next use
      latestRefreshToken = refresh_token;

      const accessToken: CalcomAccessToken = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
        scope: scope ?? ''
      };

      return accessToken;
    }

    const tokenRefresher: CalcomAccessTokenRefresher = async () => {
      const accessToken: CalcomOAuthTokenResponse = await refreshAccessToken(oauthContext)({ refreshToken: latestRefreshToken ?? undefined });
      return accessTokenFromTokenResponse(accessToken);
    };

    const loadAccessToken: CalcomAccessTokenFactory = calcomOAuthAccessTokenFactory({
      tokenRefresher,
      accessTokenCache: config.accessTokenCache
    });

    // User Access Token
    const makeUserAccessTokenFactory: CalcomOAuthMakeUserAccessTokenFactory = (input: CalcomOAuthMakeUserAccessTokenFactoryInput) => {
      let userLatestRefreshToken: string | undefined = input.refreshToken;

      const userTokenRefresher = async () => {
        const tokenResponse: CalcomOAuthTokenResponse = await refreshAccessToken(oauthContext)({ refreshToken: userLatestRefreshToken });
        const token = accessTokenFromTokenResponse(tokenResponse);
        // Track the rotated refresh token for this user
        userLatestRefreshToken = token.refreshToken;
        return token;
      };

      return calcomOAuthAccessTokenFactory({
        tokenRefresher: userTokenRefresher,
        accessTokenCache: input.userAccessTokenCache
      });
    };

    const oauthContext: CalcomOAuthContext = {
      fetch,
      fetchJson,
      loadAccessToken,
      makeUserAccessTokenFactory,
      config
    };

    const calcomOAuth: CalcomOAuth = {
      oauthContext
    };

    return calcomOAuth;
  };
}

export interface CalcomOAuthAccessTokenFactoryConfig {
  /**
   * Number of milliseconds before the expiration time a token should be discarded.
   *
   * Defaults to 1 minute.
   */
  readonly tokenExpirationBuffer?: Milliseconds;
  readonly tokenRefresher: CalcomAccessTokenRefresher;
  readonly accessTokenCache?: Maybe<CalcomAccessTokenCache>;
}

/**
 * Creates a CalcomAccessTokenFactory with multi-tier caching.
 * Checks the in-memory cache first, then the external cache, and finally refreshes
 * from the token refresher if no valid token is available.
 *
 * @param config - configuration including the token refresher, optional cache, and expiration buffer
 * @returns a CalcomAccessTokenFactory that returns a valid access token on each call
 */
export function calcomOAuthAccessTokenFactory(config: CalcomOAuthAccessTokenFactoryConfig): CalcomAccessTokenFactory {
  const { tokenRefresher, accessTokenCache, tokenExpirationBuffer: inputTokenExpirationBuffer } = config;
  const tokenExpirationBuffer = inputTokenExpirationBuffer ?? MS_IN_MINUTE;

  /**
   * Caches the token internally here until it expires.
   */
  let currentToken: Maybe<CalcomAccessToken> = null;

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
        console.error(`calcomOAuthAccessTokenFactory(): Failed retrieving new token from tokenRefresher: `, e);
        throw new CalcomOAuthAuthFailureError('Token Refresh Failed');
      }

      if (currentToken) {
        try {
          await accessTokenCache?.updateCachedToken(currentToken);
        } catch {
          // do nothing
        }
      }
    }

    return currentToken;
  };
}
