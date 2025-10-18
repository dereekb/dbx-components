import { type FactoryWithInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type ZoomAuthClientIdAndSecretPair, type ZoomAccountIdRef, type ZoomRefreshToken } from '../zoom.config';
import { type ZoomAccessTokenCache, type ZoomAccessTokenFactory } from './oauth';

/**
 * The Zoom OAuth API URL for the US datacenter.
 */
export const ZOOM_OAUTH_API_URL = 'https://zoom.us/oauth';

/**
 * Url for the Zoom OAuth API.
 *
 * https://developers.zoom.us/docs/integrations/oauth/
 */
export type ZoomOAuthApiUrl = typeof ZOOM_OAUTH_API_URL;

/**
 * Configuration for ZoomOAuth.
 */
export interface ZoomOAuthConfig extends ZoomAuthClientIdAndSecretPair, ZoomAccountIdRef {
  /**
   * Optional ZoomAccessTokenCache for caching access tokens.
   */
  readonly accessTokenCache?: Maybe<ZoomAccessTokenCache>;
}

export interface ZoomOAuthFetchFactoryInput {}

export type ZoomOAuthFetchFactory = FactoryWithInput<ConfiguredFetch, ZoomOAuthFetchFactoryInput>;

export type ZoomOAuthMakeUserAccessTokenFactoryInput = {
  readonly refreshToken: ZoomRefreshToken;
  readonly userAccessTokenCache?: Maybe<ZoomAccessTokenCache>;
};

export type ZoomOAuthMakeUserAccessTokenFactory = FactoryWithRequiredInput<ZoomAccessTokenFactory, ZoomOAuthMakeUserAccessTokenFactoryInput>;

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 */
export interface ZoomOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly loadAccessToken: ZoomAccessTokenFactory;
  readonly makeUserAccessTokenFactory: ZoomOAuthMakeUserAccessTokenFactory;
  readonly config: ZoomOAuthConfig;
}

export interface ZoomOAuthContextRef {
  readonly oauthContext: ZoomOAuthContext;
}
