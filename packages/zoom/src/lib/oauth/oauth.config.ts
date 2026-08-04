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

export interface ZoomOAuthFetchFactoryParams {}

export type ZoomOAuthFetchFactory = FactoryWithInput<ConfiguredFetch, ZoomOAuthFetchFactoryParams>;

// MARK: Credentials
/**
 * Credential for the app's own (account-level) calls.
 *
 * Exchanged as `grant_type=account_credentials`, authenticated with the client pair on
 * {@link ZoomOAuthConfig}. Unlike Cal.com's api-key equivalent the resulting token DOES expire, so
 * this arm carries its own cache.
 */
export interface ZoomAccountCredential extends ZoomAccountIdRef {
  readonly accessTokenCache?: Maybe<ZoomAccessTokenCache>;
}

/**
 * Credential for acting as a specific user.
 *
 * Exchanged as `grant_type=refresh_token`, authenticated with the same client pair.
 */
export interface ZoomRefreshTokenCredential {
  readonly refreshToken: ZoomRefreshToken;
  /**
   * Cache for THIS user's access token.
   *
   * Must be scoped to the user that owns the refresh token — handing it the account-level cache
   * would let a user token and the app's own token overwrite each other.
   */
  readonly accessTokenCache?: Maybe<ZoomAccessTokenCache>;
}

/**
 * A credential Zoom calls can be made with.
 *
 * One union for the app's own calls and for any per-user one; the credential selects the grant.
 * The client pair authenticates BOTH exchanges and so lives on the config rather than here.
 */
export type ZoomAuthCredential = ZoomAccountCredential | ZoomRefreshTokenCredential;

/**
 * Returns whether the credential is a {@link ZoomRefreshTokenCredential}.
 *
 * Checked before the account arm on purpose: `accountId` is also ambient on {@link ZoomOAuthConfig},
 * so a credential carrying both reads as a user credential that picked up an accountId — never the
 * reverse.
 *
 * @param credential - The credential to check.
 * @returns True when the credential carries a refresh token.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isZoomRefreshTokenCredential(credential: ZoomAuthCredential): credential is ZoomRefreshTokenCredential {
  return (credential as ZoomRefreshTokenCredential).refreshToken != null;
}

/**
 * The ambient credential a {@link ZoomOAuthConfig} authenticates the app's own calls with.
 *
 * Zoom's ambient credential is fully determined by the config — there is no choice to configure, so
 * it is derived here rather than being a settable field.
 *
 * @param config - The OAuth configuration.
 * @returns The account credential for that configuration.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function zoomOAuthConfigAccountCredential(config: ZoomOAuthConfig): ZoomAccountCredential {
  return { accountId: config.accountId, accessTokenCache: config.accessTokenCache };
}

export type ZoomOAuthMakeAccessTokenFactory = FactoryWithRequiredInput<ZoomAccessTokenFactory, ZoomAuthCredential>;

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 */
export interface ZoomOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  /**
   * Resolves the access token for the app's own calls.
   *
   * `makeAccessTokenFactory(zoomOAuthConfigAccountCredential(config))`, built once at construction so
   * its in-memory token tier is shared across the whole context.
   */
  readonly loadAccessToken: ZoomAccessTokenFactory;
  /**
   * Builds an access token factory for one credential.
   *
   * Each returned factory owns its own cache tier, so refreshing one credential never overwrites
   * another's token.
   */
  readonly makeAccessTokenFactory: ZoomOAuthMakeAccessTokenFactory;
  readonly config: ZoomOAuthConfig;
}

export interface ZoomOAuthContextRef {
  readonly oauthContext: ZoomOAuthContext;
}

// MARK: Compat
// COMPAT: Deprecated aliases
/**
 * @deprecated use ZoomOAuthFetchFactoryParams instead.
 */
export type ZoomOAuthFetchFactoryInput = ZoomOAuthFetchFactoryParams;
