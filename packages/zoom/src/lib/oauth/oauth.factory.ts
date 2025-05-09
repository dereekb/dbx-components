import { fetchJsonFunction, fetchApiFetchService, ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { ZOOM_OAUTH_API_URL, ZoomOAuthConfig, ZoomOAuthContext, ZoomOAuthContextRef, ZoomOAuthFetchFactory, ZoomOAuthFetchFactoryInput, ZoomOAuthMakeUserAccessTokenFactory, ZoomOAuthMakeUserAccessTokenFactoryInput } from './oauth.config';
import { LogZoomServerErrorFunction } from '../zoom.error.api';
import { ZoomOAuthAuthFailureError, handleZoomOAuthErrorFetch, interceptZoomOAuthErrorResponse } from './oauth.error.api';
import { ZoomAccessToken, ZoomAccessTokenCache, ZoomAccessTokenFactory, ZoomAccessTokenRefresher } from './oauth';
import { MS_IN_MINUTE, MS_IN_SECOND, Maybe, Milliseconds } from '@dereekb/util';
import { zoomRateLimitedFetchHandler } from '../zoom.limit';
import { serverAccessToken, userAccessToken, ZoomOAuthAccessTokenResponse } from './oauth.api';

export type ZoomOAuth = ZoomOAuthContextRef;

export interface ZoomOAuthFactoryConfig {
  /**
   * Creates a new fetch instance to use when making calls.
   */
  fetchFactory?: ZoomOAuthFetchFactory;
  /**
   * Custom log error function.
   */
  logZoomServerErrorFunction?: LogZoomServerErrorFunction;
}

export type ZoomOAuthFactory = (config: ZoomOAuthConfig) => ZoomOAuth;

export function zoomOAuthFactory(factoryConfig: ZoomOAuthFactoryConfig): ZoomOAuthFactory {
  const fetchHandler = zoomRateLimitedFetchHandler();

  const {
    logZoomServerErrorFunction,
    fetchFactory = (_?: ZoomOAuthFetchFactoryInput) =>
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
      interceptJsonResponse: interceptZoomOAuthErrorResponse, // intercept errors that return status 200
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    function accessTokenFromTokenResponse(result: ZoomOAuthAccessTokenResponse): ZoomAccessToken {
      const createdAt = new Date().getTime();
      const { access_token, api_url, scope, expires_in } = result;

      const accessToken: ZoomAccessToken = {
        accessToken: access_token,
        apiDomain: api_url,
        expiresIn: expires_in,
        expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
        scope
      };

      return accessToken;
    }

    const tokenRefresher: ZoomAccessTokenRefresher = async () => {
      const accessToken: ZoomOAuthAccessTokenResponse = await serverAccessToken(oauthContext)();
      return accessTokenFromTokenResponse(accessToken);
    };

    const loadAccessToken: ZoomAccessTokenFactory = zoomOAuthZoomAccessTokenFactory({
      tokenRefresher,
      accessTokenCache: config.accessTokenCache
    });

    // User Access Token
    const makeUserAccessTokenFactory: ZoomOAuthMakeUserAccessTokenFactory = (input: ZoomOAuthMakeUserAccessTokenFactoryInput) => {
      const userTokenRefresher = async () => {
        const accessToken: ZoomOAuthAccessTokenResponse = await userAccessToken(oauthContext)(input);
        return accessTokenFromTokenResponse(accessToken);
      };

      return zoomOAuthZoomAccessTokenFactory({
        tokenRefresher: userTokenRefresher,
        accessTokenCache: input.userAccessTokenCache
      });
    };

    const oauthContext: ZoomOAuthContext = {
      fetch,
      fetchJson,
      loadAccessToken,
      makeUserAccessTokenFactory,
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
 * Creates a ZoomOAuthZoomAccessTokenFactoryConfig
 *
 * @param config
 * @returns
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
        console.error(`zoomOAuthZoomAccessTokenFactory(): Failed retrieving new token from tokenRefresher: `, e);
        throw new ZoomOAuthAuthFailureError('Token Refresh Failed');
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
