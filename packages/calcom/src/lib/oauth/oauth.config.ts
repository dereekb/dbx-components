import { type FactoryWithInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type CalcomApiKey, type CalcomAuthClientIdAndSecretPair, type CalcomRefreshToken } from '../calcom.config';
import { type CalcomAccessTokenCache, type CalcomAccessTokenFactory } from './oauth';

/**
 * The Cal.com OAuth token endpoint URL.
 */
export const CALCOM_OAUTH_TOKEN_URL = 'https://api.cal.com/v2/oauth/token';

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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface CalcomOAuthFetchFactoryInput {}

export type CalcomOAuthFetchFactory = FactoryWithInput<ConfiguredFetch, CalcomOAuthFetchFactoryInput>;

export type CalcomOAuthMakeUserAccessTokenFactoryInput = {
  readonly refreshToken: CalcomRefreshToken;
  readonly userAccessTokenCache?: Maybe<CalcomAccessTokenCache>;
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
