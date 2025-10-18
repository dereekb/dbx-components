import { fetchJsonFunction, fetchApiFetchService, type ConfiguredFetch, returnNullHandleFetchJsonParseErrorFunction } from '@dereekb/util/fetch';
import { type ZoomServerContext, type ZoomServerContextRef, type ZoomFetchFactory, type ZoomFetchFactoryInput, type ZoomUserContext, type ZoomUserContextFactory, type ZoomUserContextFactoryInput } from './zoom.config';
import { type LogZoomServerErrorFunction } from '../zoom.error.api';
import { handleZoomErrorFetch } from './zoom.error.api';
import { type ZoomOAuthContextRef } from '../oauth/oauth.config';
import { zoomAccessTokenStringFactory } from '../oauth/oauth';
import { type ZoomRateLimitedFetchHandlerConfig, zoomRateLimitedFetchHandler } from '../zoom.limit';
import { type Maybe } from '@dereekb/util';
import { ZOOM_API_URL, type ZoomConfig } from '../zoom.config';

export type Zoom = ZoomServerContextRef;

export interface ZoomFactoryConfig extends ZoomOAuthContextRef {
  /**
   * Custom ZoomRateLimitedFetchHandlerConfig
   */
  readonly rateLimiterConfig?: Maybe<ZoomRateLimitedFetchHandlerConfig>;
  /**
   * Creates a new fetch instance to use when making calls.
   */
  readonly fetchFactory?: ZoomFetchFactory;
  /**
   * Custom log error function.
   */
  readonly logZoomServerErrorFunction?: LogZoomServerErrorFunction;
}

export type ZoomFactory = (config: ZoomConfig) => Zoom;

export function zoomFactory(factoryConfig: ZoomFactoryConfig): ZoomFactory {
  const { oauthContext } = factoryConfig;
  const serverAccessTokenStringFactory = zoomAccessTokenStringFactory(oauthContext.loadAccessToken);
  const fetchHandler = zoomRateLimitedFetchHandler(factoryConfig.rateLimiterConfig);

  const {
    logZoomServerErrorFunction,
    fetchFactory = (input: ZoomFetchFactoryInput) =>
      fetchApiFetchService.makeFetch({
        baseUrl: ZOOM_API_URL,
        baseRequest: async () => ({
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await input.zoomAccessTokenStringFactory()}`
          }
        }),
        fetchHandler,
        timeout: 20 * 1000, // 20 second timeout
        requireOkResponse: true, // enforce ok response
        useTimeout: true // use timeout
      })
  } = factoryConfig;

  return (config: ZoomConfig) => {
    const baseFetch = fetchFactory({
      zoomAccessTokenStringFactory: serverAccessTokenStringFactory
    });

    const serverFetch: ConfiguredFetch = handleZoomErrorFetch(baseFetch, logZoomServerErrorFunction);
    const serverFetchJson = fetchJsonFunction(serverFetch, {
      handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
    });

    // MARK: Make User Context
    const makeUserContext: ZoomUserContextFactory = (input: ZoomUserContextFactoryInput) => {
      const userAccessTokenFactory = oauthContext.makeUserAccessTokenFactory({
        refreshToken: input.refreshToken,
        userAccessTokenCache: input.accessTokenCache
      });

      const userAccessTokenStringFactory = zoomAccessTokenStringFactory(userAccessTokenFactory);

      const userFetch = fetchFactory({
        zoomAccessTokenStringFactory: userAccessTokenStringFactory
      });

      const userFetchJson = fetchJsonFunction(userFetch, {
        handleFetchJsonParseErrorFunction: returnNullHandleFetchJsonParseErrorFunction
      });

      const result: ZoomUserContext = {
        zoomServerContext: zoomContext,
        type: 'user',
        fetch: userFetch,
        fetchJson: userFetchJson,
        userFetch,
        userFetchJson,
        zoomRateLimiter: fetchHandler._rateLimiter
      };

      return result;
    };

    const zoomContext: ZoomServerContext = {
      type: 'server',
      fetch: serverFetch,
      fetchJson: serverFetchJson,
      serverFetch,
      serverFetchJson,
      makeUserContext,
      config,
      zoomRateLimiter: fetchHandler._rateLimiter
    };

    const zoom: Zoom = {
      zoomServerContext: zoomContext
    };

    return zoom;
  };
}
