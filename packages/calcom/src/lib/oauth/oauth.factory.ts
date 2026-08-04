import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, type FetchHandler, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { CALCOM_OAUTH_API_URL, isCalcomApiKeyCredential, type CalcomAuthCredential, type CalcomOAuthConfig, type CalcomOAuthContext, type CalcomOAuthContextRef, type CalcomOAuthFetchFactory, type CalcomOAuthFetchFactoryInput, type CalcomOAuthMakeAccessTokenFactory } from './oauth.config';
import { type CalcomApiKey, type CalcomRefreshToken } from '../calcom.config';
import { type LogCalcomServerErrorFunction } from '../calcom.error.api';
import { CalcomOAuthAuthFailureError, handleCalcomOAuthErrorFetch } from './oauth.error.api';
import { type CalcomAccessToken, type CalcomAccessTokenCache, type CalcomAccessTokenFactory, type CalcomAccessTokenRefresher } from './oauth';
import { MS_IN_DAY, MS_IN_MINUTE, MS_IN_SECOND, type Maybe, type Milliseconds } from '@dereekb/util';
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

/**
 * The lifetime given to the synthetic access token an api key is wrapped in.
 *
 * Cal.com api keys do not expire; the value only has to outlive any process holding one, so the
 * token satisfies the same expiration check every other token goes through.
 */
export const CALCOM_API_KEY_ACCESS_TOKEN_EXPIRATION: Milliseconds = MS_IN_DAY * 365 * 100;

/**
 * Wraps a {@link CalcomApiKey} as a static {@link CalcomAccessToken}.
 *
 * An api key is already a bearer token acting as the user who created it, so there is nothing to
 * exchange and nothing to refresh.
 *
 * @param apiKey - The Cal.com api key.
 * @returns The equivalent static CalcomAccessToken.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomAccessTokenFromApiKey(apiKey: CalcomApiKey): CalcomAccessToken {
  const accessToken: CalcomAccessToken = {
    accessToken: apiKey,
    refreshToken: '',
    expiresIn: Number.MAX_SAFE_INTEGER,
    expiresAt: new Date(Date.now() + CALCOM_API_KEY_ACCESS_TOKEN_EXPIRATION),
    scope: ''
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
    const { defaultAuth, client } = config;
    const hasApiKeyDefault = defaultAuth != null && isCalcomApiKeyCredential(defaultAuth) && !!defaultAuth.apiKey;

    // an API key IS the token; every other credential is an exchange the token endpoint authenticates
    // with the client id and secret. With neither, no token could ever be produced
    if (!hasApiKeyDefault && client == null) {
      throw new Error('CalcomOAuthConfig can authenticate nothing. Provide `defaultAuth: { apiKey }` for ambient calls, `client` (clientId+clientSecret) to exchange any refresh token, or both.');
    }

    const baseFetch = fetchFactory();

    const fetch: ConfiguredFetch = handleCalcomOAuthErrorFetch(baseFetch, logCalcomServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    // MARK: Access Tokens
    const makeAccessTokenFactory: CalcomOAuthMakeAccessTokenFactory = (credential: CalcomAuthCredential) => {
      let result: CalcomAccessTokenFactory;

      if (isCalcomApiKeyCredential(credential)) {
        const { apiKey } = credential;

        // presence, not truthiness, is what discriminates the union — so without this an empty key
        // would be handed back as a valid static token and every call would send `Bearer `
        if (!apiKey) {
          throw new Error('CalcomApiKeyCredential.apiKey is empty.');
        }

        const apiKeyToken = calcomAccessTokenFromApiKey(apiKey);

        result = async () => apiKeyToken;
      } else {
        // a token for a specific grant can only come from that grant's refresh token, exchanged
        // against the OAuth client. An API key is a different user's identity and cannot stand in
        if (client == null) {
          throw new Error('makeAccessTokenFactory() requires a `client` (clientId+clientSecret) to exchange a refresh token credential. A Cal.com configuration with only an api key cannot create one.');
        }

        /**
         * Tracks THIS credential's rotated refresh token, since Cal.com rotates on every use.
         *
         * Declared per invocation, so every credential — the default one as much as any per-user one
         * — rotates in isolation and refreshing one never overwrites another's token.
         */
        let latestRefreshToken: CalcomRefreshToken = credential.refreshToken;

        const tokenRefresher: CalcomAccessTokenRefresher = async () => {
          const response: CalcomOAuthTokenResponse = await refreshAccessToken(oauthContext)({ refreshToken: latestRefreshToken });
          const accessToken = calcomAccessTokenFromTokenResponse(response);

          latestRefreshToken = accessToken.refreshToken;

          return accessToken;
        };

        result = calcomOAuthAccessTokenFactory({
          tokenRefresher,
          accessTokenCache: credential.accessTokenCache
        });
      }

      return result;
    };

    // built once, so the default credential's in-memory tier and its rotation are shared across the
    // whole context instead of restarting on every call
    const loadAccessToken: CalcomAccessTokenFactory =
      defaultAuth == null
        ? async () => {
            throw new CalcomOAuthAuthFailureError('No `defaultAuth` is configured on this CalcomOAuthConfig, so there is no ambient credential to authenticate with. Use makeAccessTokenFactory(credential) for a named credential.');
          }
        : makeAccessTokenFactory(defaultAuth);

    const oauthContext: CalcomOAuthContext = {
      fetch,
      fetchJson,
      loadAccessToken,
      makeAccessTokenFactory,
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
