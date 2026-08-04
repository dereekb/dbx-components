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
 * How the app's OWN (server-level) Cal.com calls authenticate.
 *
 * Separate from {@link CalcomOAuthConfig.client} because the two are independent concerns, and
 * conflating them is a real trap: an app can authenticate its own calls with an API key while its
 * users' connections run through the OAuth client, and treating a configured API key as the whole
 * story silently disables every per-user context.
 */
export interface CalcomOAuthServerAuthConfig {
  /**
   * API key for simple bearer token auth, acting as the user who created it.
   *
   * Takes precedence over {@link refreshToken} when both are set: the key does not expire, so
   * server-level calls skip the OAuth refresh loop entirely. Has NO effect on per-user contexts,
   * which can only come from a user's own grant.
   */
  readonly apiKey?: Maybe<CalcomApiKey>;
  /**
   * Server-level refresh token, exchanged against {@link CalcomOAuthConfig.client}.
   *
   * Cal.com rotates it on every use, so the context tracks the latest value internally rather than
   * re-reading this one.
   */
  readonly refreshToken?: Maybe<CalcomRefreshToken>;
  /**
   * Optional cache for the server-level access token.
   *
   * Per-user tokens are cached separately, per user — see
   * {@link CalcomOAuthMakeUserAccessTokenFactoryInput.userAccessTokenCache}.
   */
  readonly accessTokenCache?: Maybe<CalcomAccessTokenCache>;
}

/**
 * Configuration for CalcomOAuth.
 *
 * Split along the only line that matters at runtime: how the APP authenticates versus what is needed
 * to act as a USER. An app that only acts for its users needs just `client`; an app that only makes
 * its own calls needs `serverAuth.apiKey`, or a `serverAuth.refreshToken` AND the `client` to exchange
 * it against — a refresh token alone is not credentials, since the token endpoint authenticates the
 * exchange with the client id and secret.
 */
export interface CalcomOAuthConfig {
  /**
   * How the app's own calls authenticate. Without one, only per-user contexts are usable.
   */
  readonly serverAuth?: Maybe<CalcomOAuthServerAuthConfig>;
  /**
   * The OAuth client. Its presence — and ONLY its presence — is what enables per-user contexts.
   *
   * Both halves of the pair are required together, so a client cannot be half-configured into a state
   * that composes an authorize URL carrying `client_id=undefined`.
   */
  readonly client?: Maybe<CalcomAuthClientIdAndSecretPair>;
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
