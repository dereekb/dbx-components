import { type FactoryWithInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZoomConfig, type ZoomRefreshToken } from '../zoom.config';
import { type ZoomRateLimiterRef } from '../zoom.limit';
import { type ZoomAccessTokenCache, type ZoomAccessTokenStringFactory } from '../oauth/oauth';

export type ZoomApiKey = ZoomRefreshToken;

export interface ZoomFetchFactoryInput {
  readonly zoomAccessTokenStringFactory: ZoomAccessTokenStringFactory;
}

export type ZoomFetchFactory = FactoryWithInput<ConfiguredFetch, ZoomFetchFactoryInput>;

/**
 * Denotes the type of authorization used by the ZoomContext.
 *
 * - 'server': Uses Server to Server authorization
 * - 'user': Uses User to Server authorization
 */
export type ZoomContextType = 'server' | 'user';

/**
 * A zoom context that can send requests to the Zoom API.
 */
export interface ZoomContext extends ZoomRateLimiterRef {
  /**
   * Type of context this is.
   */
  readonly type: ZoomContextType;
  /**
   * Performs a fetch as the server.
   */
  readonly fetch: ConfiguredFetch;
  /**
   * Performs a json fetch as the server.
   */
  readonly fetchJson: FetchJsonFunction;
}

export interface ZoomServerContext extends ZoomContext {
  readonly type: 'server';
  readonly serverFetch: ConfiguredFetch;
  readonly serverFetchJson: FetchJsonFunction;
  readonly makeUserContext: ZoomUserContextFactory;
  readonly config: ZoomConfig;
}

export interface ZoomUserContextFactoryInput {
  /**
   * The user's refresh token.
   */
  readonly refreshToken: ZoomRefreshToken;
  /**
   * Optional cache to use for the user's access token.
   *
   * The cache should only be configured for the user that owns the refresh token.
   */
  readonly accessTokenCache?: Maybe<ZoomAccessTokenCache>;
}

/**
 * Creates a ZoomUserContext from the input.
 */
export type ZoomUserContextFactory = FactoryWithRequiredInput<ZoomUserContext, ZoomUserContextFactoryInput>;

/**
 * Context used for performing fetch requests for a specific user.
 */
export interface ZoomUserContext extends ZoomContext {
  readonly type: 'user';
  readonly zoomServerContext: ZoomServerContext;
  readonly userFetch: ConfiguredFetch;
  readonly userFetchJson: FetchJsonFunction;
}

export interface ZoomServerContextRef {
  readonly zoomServerContext: ZoomServerContext;
}
