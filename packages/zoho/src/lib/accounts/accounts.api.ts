import { Maybe } from '@dereekb/util';

/**
 * Arbitrary key used to identify a specific service.
 *
 * I.E. recruit
 */
export type ZohoServiceAccessTokenKey = string;

/**
 * Access token generated from a refresh token.
 */
export type ZohoAccessTokenString = string;

export interface ZohoAccessToken {
  readonly accessToken: ZohoAccessTokenString;
  readonly expiresIn: number;
}

/**
 * Used for retrieving and storing ZohoAccessToken values.
 */
export interface ZohoAccessTokenCache {
  /**
   * Loads the token from the cache, if available.
   *
   * The token may be expired.
   */
  loadCachedToken(): Promise<Maybe<ZohoAccessToken>>;
  /**
   * Updates the cache with the given access token.
   */
  updateCachedToken(accessToken: ZohoAccessToken): Promise<void>;
}

/**
 * Source for retriving a ZohoAccessToken.
 */
export type ZohoAccessTokenFactory = () => Promise<ZohoAccessToken>;

/**
 * A ZohoAccessTokenFactory that always generates a new ZohoAccessToken.
 */
export type ZohoAccessTokenRefresher = ZohoAccessTokenFactory;
