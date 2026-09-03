import { type FactoryWithInput, type FactoryWithRequiredInput, type Maybe } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';
import { type CalcomApiKey, type CalcomAuthClientIdAndSecretPair, type CalcomRefreshToken } from '../calcom.config';
import { type CalcomAccessTokenCache, type CalcomAccessTokenFactory } from './oauth';

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

// MARK: Credentials
/**
 * Authenticates as the Cal.com user who created the API key.
 *
 * The key IS the bearer token and does not expire, so this credential never reaches the token
 * endpoint and needs no {@link CalcomOAuthConfig.client}.
 */
export interface CalcomApiKeyCredential {
  readonly apiKey: CalcomApiKey;
}

/**
 * Authenticates as the Cal.com user who granted the refresh token.
 *
 * Every exchange is authenticated with {@link CalcomOAuthConfig.client}'s id and secret, so this
 * credential is unusable without one.
 */
export interface CalcomRefreshTokenCredential {
  /**
   * The grant's refresh token.
   *
   * Cal.com rotates it on every use. The factory built from this credential tracks the rotation in
   * memory, so this value is read once rather than re-read per refresh.
   */
  readonly refreshToken: CalcomRefreshToken;
  /**
   * Cache for THIS credential's access token.
   *
   * Must be scoped to exactly this grant. Two credentials sharing one cache overwrite each other,
   * and the rotated refresh token rides along inside the cached value — so a shared cache does not
   * merely lose a token, it spends one.
   */
  readonly accessTokenCache?: Maybe<CalcomAccessTokenCache>;
}

/**
 * A credential Cal.com calls can be made with.
 *
 * One union for the ambient credential and for any per-user one, because they are the same thing:
 * a way to act as some Cal.com user. Discriminated by the presence of `apiKey`.
 */
export type CalcomAuthCredential = CalcomApiKeyCredential | CalcomRefreshTokenCredential;

/**
 * Returns whether the credential is a {@link CalcomApiKeyCredential}.
 *
 * @param credential - The credential to check.
 * @returns True when the credential carries an api key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isCalcomApiKeyCredential(credential: CalcomAuthCredential): credential is CalcomApiKeyCredential {
  return 'apiKey' in credential;
}

export interface CalcomAuthCredentialValues {
  readonly apiKey?: Maybe<CalcomApiKey>;
  readonly refreshToken?: Maybe<CalcomRefreshToken>;
  readonly accessTokenCache?: Maybe<CalcomAccessTokenCache>;
}

/**
 * Builds a {@link CalcomAuthCredential} from flat, optional values, as an environment-facing
 * configuration provides them.
 *
 * An api key wins when both are present: it does not expire, so it skips the refresh loop entirely.
 * The cache attaches only to the refresh-token arm, since an api key has no token to cache. Empty
 * strings count as absent, so an unset environment variable read as `''` does not become a
 * credential that sends `Bearer `.
 *
 * @param values - The flat credential values.
 * @returns The equivalent credential, or undefined when neither value is present.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomAuthCredentialFromValues(values: CalcomAuthCredentialValues): Maybe<CalcomAuthCredential> {
  const { apiKey, refreshToken, accessTokenCache } = values;
  let result: Maybe<CalcomAuthCredential>;

  if (apiKey) {
    result = { apiKey };
  } else if (refreshToken) {
    result = { refreshToken, accessTokenCache };
  }

  return result;
}

/**
 * Configuration for CalcomOAuth.
 *
 * `client` is the app's OAuth *registration*. It is sent on EVERY token exchange — the ambient one
 * as much as any per-user one — so it is not "the user half" of anything.
 *
 * `defaultAuth` is the credential used when no specific one is named, and is the only thing
 * `loadAccessToken()` reads. It is not an "app identity" either: an api key acts as the user who
 * created it, and a refresh token here is some user's grant being reused ambiently.
 *
 * An app that only acts for named users needs just `client`. An app that makes ambient calls needs
 * a `defaultAuth`, plus `client` whenever that credential is a refresh token.
 */
export interface CalcomOAuthConfig {
  /**
   * The OAuth client registration, required for ANY refresh-token exchange.
   *
   * Both halves of the pair are required together, so a client cannot be half-configured into a state
   * that composes an authorize URL carrying `client_id=undefined`.
   */
  readonly client?: Maybe<CalcomAuthClientIdAndSecretPair>;
  /**
   * The credential used when no specific one is named.
   */
  readonly defaultAuth?: Maybe<CalcomAuthCredential>;
}

export interface CalcomOAuthFetchFactoryInput {}

export type CalcomOAuthFetchFactory = FactoryWithInput<ConfiguredFetch, CalcomOAuthFetchFactoryInput>;

export type CalcomOAuthMakeAccessTokenFactory = FactoryWithRequiredInput<CalcomAccessTokenFactory, CalcomAuthCredential>;

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 */
export interface CalcomOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  /**
   * Resolves the access token for {@link CalcomOAuthConfig.defaultAuth}.
   *
   * `makeAccessTokenFactory(config.defaultAuth)`, built once at construction so its in-memory token
   * tier and its refresh-token rotation are shared across the whole context.
   */
  readonly loadAccessToken: CalcomAccessTokenFactory;
  /**
   * Builds an access token factory for one credential.
   *
   * Each returned factory owns its own rotation and cache tier, so refreshing one credential never
   * spends another's token.
   */
  readonly makeAccessTokenFactory: CalcomOAuthMakeAccessTokenFactory;
  readonly config: CalcomOAuthConfig;
}

export interface CalcomOAuthContextRef {
  readonly oauthContext: CalcomOAuthContext;
}
