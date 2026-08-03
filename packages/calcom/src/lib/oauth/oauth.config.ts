import { type FactoryWithInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type CalcomApiKey, type CalcomAuthClientIdAndSecretPair, type CalcomRefreshToken } from '../calcom.config';
import { type CalcomAccessTokenCache, type CalcomAccessTokenCacheKey, type CalcomAccessTokenFactory } from './oauth';

/**
 * The Cal.com OAuth API base URL.
 *
 * Endpoint paths are appended to this base, so it intentionally carries no endpoint segment of
 * its own. This is the single place the OAuth host and prefix are encoded.
 */
export const CALCOM_OAUTH_API_URL = 'https://api.cal.com/v2/auth/oauth2';

export type CalcomOAuthApiUrl = typeof CALCOM_OAUTH_API_URL;

/**
 * The Cal.com OAuth token endpoint path, relative to {@link CALCOM_OAUTH_API_URL}.
 */
export const CALCOM_OAUTH_TOKEN_PATH = '/token';

/**
 * The Cal.com OAuth authorize URL.
 */
export const CALCOM_OAUTH_AUTHORIZE_URL = 'https://app.cal.com/auth/oauth2/authorize';

/**
 * Configuration for CalcomOAuth.
 */
export interface CalcomOAuthConfig extends Partial<CalcomAuthClientIdAndSecretPair> {
  /**
   * Optional CalcomAccessTokenCache for caching access tokens.
   */
  readonly accessTokenCache?: Maybe<CalcomAccessTokenCache>;
  /**
   * Server-level refresh token for initial authentication.
   */
  readonly refreshToken?: Maybe<CalcomRefreshToken>;
  /**
   * Optional API key for simple bearer token auth.
   *
   * When provided, OAuth token refresh is skipped and the API key is used directly as the bearer token.
   * Does not expire and requires no refresh.
   */
  readonly apiKey?: Maybe<CalcomApiKey>;
}

export interface CalcomOAuthFetchFactoryInput {}

export type CalcomOAuthFetchFactory = FactoryWithInput<ConfiguredFetch, CalcomOAuthFetchFactoryInput>;

export type CalcomOAuthMakeUserAccessTokenFactoryInput = {
  readonly refreshToken: CalcomRefreshToken;
  readonly userAccessTokenCache?: Maybe<CalcomAccessTokenCache>;
  /**
   * Optional stable, caller-owned key identifying whose token this is.
   *
   * Used to memoize the produced factory so its in-memory tier is shared across calls. Prefer an
   * id the caller already owns (a user/profile id) over anything derived from the refresh token,
   * which Cal.com rotates on every use.
   */
  readonly key?: Maybe<CalcomAccessTokenCacheKey>;
};

export type CalcomOAuthMakeUserAccessTokenFactory = FactoryWithRequiredInput<CalcomAccessTokenFactory, CalcomOAuthMakeUserAccessTokenFactoryInput>;

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 */
export interface CalcomOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly loadAccessToken: CalcomAccessTokenFactory;
  readonly makeUserAccessTokenFactory: CalcomOAuthMakeUserAccessTokenFactory;
  readonly config: CalcomOAuthConfig;
}

export interface CalcomOAuthContextRef {
  readonly oauthContext: CalcomOAuthContext;
}

// COMPAT: Deprecated aliases
/**
 * @deprecated use {@link CALCOM_OAUTH_API_URL} instead. This was previously used as the fetch base
 * URL while the endpoint path `/oauth/token` was also appended, resolving to a doubly-pathed URL.
 */
export const CALCOM_OAUTH_TOKEN_URL = `${CALCOM_OAUTH_API_URL}${CALCOM_OAUTH_TOKEN_PATH}`;
