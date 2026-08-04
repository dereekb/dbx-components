import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, type FetchHandler, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { ZOOM_OAUTH_API_URL, isZoomRefreshTokenCredential, zoomOAuthConfigAccountCredential, type ZoomAuthCredential, type ZoomOAuthConfig, type ZoomOAuthContext, type ZoomOAuthContextRef, type ZoomOAuthFetchFactory, type ZoomOAuthMakeAccessTokenFactory } from './oauth.config';
import { type LogZoomServerErrorFunction } from '../zoom.error.api';
import { ZoomOAuthAuthFailureError, handleZoomOAuthErrorFetch } from './oauth.error.api';
import { type ZoomAccessToken, type ZoomAccessTokenCache, type ZoomAccessTokenFactory, type ZoomAccessTokenRefresher } from './oauth';
import { MS_IN_MINUTE, MS_IN_SECOND, type Maybe, type Milliseconds } from '@dereekb/util';
import { zoomRateLimitedFetchHandler } from '../zoom.limit';
import { serverAccessToken, userAccessToken, type ZoomOAuthAccessTokenResponse } from './oauth.api';

export type ZoomOAuth = ZoomOAuthContextRef;

/**
 * Maps a {@link ZoomOAuthAccessTokenResponse} to a {@link ZoomAccessToken}.
 *
 * @param response - The token response returned by the Zoom token endpoint.
 * @returns The equivalent ZoomAccessToken, with `expiresAt` resolved against the current time.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zoomAccessTokenFromTokenResponse(response: ZoomOAuthAccessTokenResponse): ZoomAccessToken {
  const createdAt = Date.now();
  const { access_token, api_url, scope, expires_in } = response;

  const accessToken: ZoomAccessToken = {
    accessToken: access_token,
    apiDomain: api_url,
    expiresIn: expires_in,
    expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
    scope
  };

  return accessToken;
}

export interface ZoomOAuthFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  readonly fetchFactory?: ZoomOAuthFetchFactory;
  /**
   * Custom FetchHandler to use with the default fetchFactory.
   *
   * Defaults to a {@link zoomRateLimitedFetchHandler}. Ignored when a `fetchFactory` is provided.
   */
  readonly fetchHandler?: Maybe<FetchHandler>;
  /**
   * Custom log error function.
   */
  readonly logZoomServerErrorFunction?: LogZoomServerErrorFunction;
}

export type ZoomOAuthFactory = (config: ZoomOAuthConfig) => ZoomOAuth;

/**
 * Creates a ZoomOAuth instance factory from the given configuration.
 *
 * @param factoryConfig - Configuration for the OAuth factory.
 * @returns A factory that creates configured ZoomOAuth instances.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zoomOAuthFactory(factoryConfig: ZoomOAuthFactoryConfig): ZoomOAuthFactory {
  const fetchHandler = factoryConfig.fetchHandler ?? zoomRateLimitedFetchHandler();

  const {
    logZoomServerErrorFunction,
    fetchFactory = () =>
      fetchApiFetchService.makeFetch({
        baseUrl: ZOOM_OAUTH_API_URL,
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

  return (config: ZoomOAuthConfig) => {
    if (!config.clientId) {
      throw new Error('ZoomOAuthConfig missing clientId.');
    } else if (!config.clientSecret) {
      throw new Error('ZoomOAuthConfig missing clientSecret.');
    } else if (!config.accountId) {
      throw new Error('ZoomOAuthConfig missing accountId.');
    }

    const baseFetch = fetchFactory();

    const fetch: ConfiguredFetch = handleZoomOAuthErrorFetch(baseFetch, logZoomServerErrorFunction);
    const fetchJson = fetchJsonFunction(fetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    // MARK: Access Token
    // both grants are Basic-authed with the SAME client pair (see zoomOAuthApiFetchJsonInput), and the
    // guards above already require it — so unlike Cal.com there is no credential this context cannot
    // exchange. All a credential selects is which grant is used
    const makeAccessTokenFactory: ZoomOAuthMakeAccessTokenFactory = (credential: ZoomAuthCredential) => {
      let tokenRefresher: ZoomAccessTokenRefresher;

      if (isZoomRefreshTokenCredential(credential)) {
        const { refreshToken } = credential;
        tokenRefresher = async () => zoomAccessTokenFromTokenResponse(await userAccessToken(oauthContext)({ refreshToken }));
      } else {
        const { accountId } = credential;
        tokenRefresher = async () => zoomAccessTokenFromTokenResponse(await serverAccessToken(oauthContext)({ accountId }));
      }

      return zoomOAuthZoomAccessTokenFactory({
        tokenRefresher,
        accessTokenCache: credential.accessTokenCache
      });
    };

    // built once, so the account credential's in-memory tier is shared across the whole context
    const loadAccessToken: ZoomAccessTokenFactory = makeAccessTokenFactory(zoomOAuthConfigAccountCredential(config));

    const oauthContext: ZoomOAuthContext = {
      fetch,
      fetchJson,
      loadAccessToken,
      makeAccessTokenFactory,
      config
    };

    const zoomOAuth: ZoomOAuth = {
      oauthContext
    };

    return zoomOAuth;
  };
}

export interface ZoomOAuthZoomAccessTokenFactoryConfig {
  /**
   * Number of milliseconds before the expiration time a token should be discarded.
   *
   * Defaults to 1 minute.
   */
  readonly tokenExpirationBuffer?: Milliseconds;
  readonly tokenRefresher: ZoomAccessTokenRefresher;
  readonly accessTokenCache?: Maybe<ZoomAccessTokenCache>;
}

/**
 * Creates a ZoomOAuthZoomAccessTokenFactoryConfig.
 *
 * @param config
 * @returns
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zoomOAuthZoomAccessTokenFactory(config: ZoomOAuthZoomAccessTokenFactoryConfig): ZoomAccessTokenFactory {
  const { tokenRefresher, accessTokenCache, tokenExpirationBuffer: inputTokenExpirationBuffer } = config;
  const tokenExpirationBuffer = inputTokenExpirationBuffer ?? MS_IN_MINUTE;

  /**
   * Caches the token internally here until it expires.
   */
  let currentToken: Maybe<ZoomAccessToken> = null;

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
        console.error(`zoomOAuthZoomAccessTokenFactory(): Failed retrieving new token from tokenRefresher: `, e);
        throw new ZoomOAuthAuthFailureError('Token Refresh Failed');
      }

      try {
        await accessTokenCache?.updateCachedToken(currentToken);
      } catch {
        // do nothing
      }
    }

    return currentToken;
  };
}
