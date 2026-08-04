import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, type FetchHandler, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { CALCOM_OAUTH_API_URL, type CalcomOAuthConfig, type CalcomOAuthContext, type CalcomOAuthContextRef, type CalcomOAuthFetchFactory, type CalcomOAuthFetchFactoryInput, type CalcomOAuthMakeUserAccessTokenFactory, type CalcomOAuthMakeUserAccessTokenFactoryInput } from './oauth.config';
import { type CalcomRefreshToken } from '../calcom.config';
import { type LogCalcomServerErrorFunction } from '../calcom.error.api';
import { CalcomOAuthAuthFailureError, handleCalcomOAuthErrorFetch } from './oauth.error.api';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomAccessTokenFactory, type CalcomAccessTokenRefresher } from './oauth';
import { MS_IN_MINUTE, MS_IN_SECOND, type Maybe, type Milliseconds } from '@dereekb/util';
import { calcomRateLimitedFetchHandler } from '../calcom.limit';
import { refreshAccessToken, type CalcomOAuthTokenResponse } from './oauth.api';

export type CalcomOAuth = CalcomOAuthContextRef;

/**
 * Maps a {@link CalcomOAuthTokenResponse} to a {@link CalcomAccessToken}.
 *
 * Pure: the caller owns the rotated refresh token that comes back on the result, so each token
 * scope (server-level vs per-user) tracks its own rotation instead of sharing one variable.
 *
 * @param response - The token response returned by the Cal.com token endpoint.
 * @returns The equivalent CalcomAccessToken, with `expiresAt` resolved against the current time.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomAccessTokenFromTokenResponse(response: CalcomOAuthTokenResponse): CalcomAccessToken {
  const createdAt = Date.now();
  const { access_token, refresh_token, scope, expires_in } = response;

  const accessToken: CalcomAccessToken = {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
    scope: scope ?? ''
  };

  return accessToken;
}

export interface CalcomOAuthFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  readonly fetchFactory?: CalcomOAuthFetchFactory;
  /**
   * Custom FetchHandler to use with the default fetchFactory.
   *
   * Defaults to a {@link calcomRateLimitedFetchHandler}. Ignored when a `fetchFactory` is provided.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
  /**
   * Custom log error function.
   */
  readonly logCalcomServerErrorFunction?: LogCalcomServerErrorFunction;
}

export type CalcomOAuthFactory = (config: CalcomOAuthConfig) => CalcomOAuth;

/**
 * Creates a {@link CalcomOAuthFactory} that produces configured Cal.com OAuth instances.
 * Supports both API key authentication (static token, no refresh) and full OAuth
 * refresh token flow with automatic token rotation.
 *
 * @param factoryConfig - Configuration including optional fetch factory and error logging.
 * @returns A factory function that accepts a CalcomOAuthConfig and produces a CalcomOAuth instance.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomOAuthFactory(factoryConfig: CalcomOAuthFactoryConfig): CalcomOAuthFactory {
  const fetchHandler = factoryConfig.fetchHandler ?? calcomRateLimitedFetchHandler();

  const {
    logCalcomServerErrorFunction,
    fetchFactory = (_?: CalcomOAuthFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: CALCOM_OAUTH_API_URL,
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
    const apiKey = config.apiKey;
    /**
     * Whether the per-user path is available.
     *
     * Tracked separately from how SERVER-level calls authenticate, because the two are independent: an
     * app can hold an API key for its own calls and an OAuth client for its users' connections, and
     * before this was separated a configured API key silently disabled every per-user context.
     */
    const hasOAuthClient = !!config.clientId && !!config.clientSecret;

    if (!apiKey && !hasOAuthClient) {
      if (config.clientId) {
        throw new Error('CalcomOAuthConfig missing clientSecret.');
      } else {
        throw new Error('CalcomOAuthConfig missing clientId. Provide clientId+clientSecret for OAuth or apiKey for API key auth.');
      }
    }

    const baseFetch = fetchFactory();

    const fetch: ConfiguredFetch = handleCalcomOAuthErrorFetch(baseFetch, logCalcomServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    // MARK: Server Access Token
    /**
     * Tracks the latest server-level refresh token since Cal.com rotates them on every use.
     *
     * Scoped to the server-level refresher only — each per-user refresher tracks its own rotation,
     * so refreshing one user never overwrites the server-level token.
     */
    let latestRefreshToken = config.refreshToken;

    const tokenRefresher: CalcomAccessTokenRefresher = async () => {
      const response: CalcomOAuthTokenResponse = await refreshAccessToken(oauthContext)({ refreshToken: latestRefreshToken ?? undefined });
      const accessToken = calcomAccessTokenFromTokenResponse(response);

      latestRefreshToken = accessToken.refreshToken;

      return accessToken;
    };

    // an API key acts as the user who created it and does not expire, so it is handed back as a static
    // token with nothing to refresh. It takes precedence for server-level calls when configured
    const apiKeyToken: Maybe<CalcomAccessToken> = apiKey
      ? {
          accessToken: apiKey,
          refreshToken: '',
          expiresIn: Number.MAX_SAFE_INTEGER,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100), // 100 years
          scope: ''
        }
      : undefined;

    const loadAccessToken: CalcomAccessTokenFactory =
      apiKeyToken == null
        ? calcomOAuthAccessTokenFactory({
            tokenRefresher,
            accessTokenCache: config.accessTokenCache
          })
        : async () => apiKeyToken;

    // MARK: User Access Token
    const makeUserAccessTokenFactory: CalcomOAuthMakeUserAccessTokenFactory = (input: CalcomOAuthMakeUserAccessTokenFactoryInput) => {
      // an access token for a USER can only come from that user's refresh token, exchanged against the
      // OAuth client. An API key is the app's own identity and cannot stand in for it
      if (!hasOAuthClient) {
        throw new Error('makeUserAccessTokenFactory requires clientId+clientSecret. An api-key-only Cal.com configuration cannot create per-user contexts.');
      }

      /**
       * Tracks this user's rotated refresh token, independently of the server-level token.
       */
      let userLatestRefreshToken: CalcomRefreshToken = input.refreshToken;

      const userTokenRefresher: CalcomAccessTokenRefresher = async () => {
        const response: CalcomOAuthTokenResponse = await refreshAccessToken(oauthContext)({ refreshToken: userLatestRefreshToken });
        const accessToken = calcomAccessTokenFromTokenResponse(response);

        userLatestRefreshToken = accessToken.refreshToken;

        return accessToken;
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
 * @param config - Configuration including the token refresher, optional cache, and expiration buffer.
 * @returns A CalcomAccessTokenFactory that returns a valid access token on each call.
 *
 * @__NO_SIDE_EFFECTS__
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
