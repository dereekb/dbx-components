import { FactoryWithInput, FactoryWithRequiredInput, Maybe } from '@dereekb/util';
import { ConfiguredFetch, FetchJsonFunction } from '@dereekb/util/fetch';
import { ZoomConfig, ZoomRefreshToken } from '../zoom.config';
import { ZoomRateLimiterRef } from '../zoom.limit';
import { ZoomAccessTokenCache, ZoomAccessTokenStringFactory } from '../oauth/oauth';

export type ZoomApiKey = ZoomRefreshToken;

export interface ZoomFetchFactoryInput {
  readonly zoomAccessTokenStringFactory: ZoomAccessTokenStringFactory;
}

export type ZoomFetchFactory = FactoryWithInput<ConfiguredFetch, ZoomFetchFactoryInput>;

export interface ZoomContext extends ZoomRateLimiterRef {
  /**
   * Performs a fetch as the server.
   */
  readonly serverFetch: ConfiguredFetch;
  /**
   * Performs a json fetch as the server.
   */
  readonly serverFetchJson: FetchJsonFunction;
  /**
   * Creates a user context from the input.
   */
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
export interface ZoomUserContext extends ZoomRateLimiterRef {
  readonly zoomContext: ZoomContext;
  readonly userFetch: ConfiguredFetch;
  readonly userFetchJson: FetchJsonFunction;
}

export interface ZoomContextRef {
  readonly zoomContext: ZoomContext;
}
