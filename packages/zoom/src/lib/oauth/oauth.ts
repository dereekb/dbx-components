import { type Maybe } from '@dereekb/util';
import { ZoomOAuthAuthFailureError } from './oauth.error.api';

/**
 * Access token authorization string generated from a refresh token.
 */
export type ZoomAccessTokenString = string;

/**
 * Scopes string for a ZoomAccessToken that is space-separated.
 *
 * Example: "user:read:user:admin api:write:zoom etc:etc:etc"
 */
export type ZoomAccessTokenScopesString = string;

/**
 * Api domain string for a ZoomAccessToken
 *
 * Example: "https://api.zoom.us"
 */
export type ZoomAccessTokenApiDomain = string;

/**
 * Zoom account access token.
 */
export interface ZoomAccessToken {
  readonly accessToken: ZoomAccessTokenString;
  readonly scope: ZoomAccessTokenScopesString;
  /**
   * Api domain for the token.
   */
  readonly apiDomain: ZoomAccessTokenApiDomain;
  /**
   * Length of time the token is valid for.
   */
  readonly expiresIn: number;
  /**
   * Date the token expires at.
   */
  readonly expiresAt: Date;
}

/**
 * Used for retrieving and storing ZoomAccessToken values.
 */
export interface ZoomAccessTokenCache {
  /**
   * Loads the token from the cache, if available.
   *
   * The token may be expired.
   */
  loadCachedToken(): Promise<Maybe<ZoomAccessToken>>;
  /**
   * Updates the cache with the given access token.
   */
  updateCachedToken(accessToken: ZoomAccessToken): Promise<void>;
}

/**
 * Source for retriving a ZoomAccessToken.
 *
 * Throws an ZoomOAuthAuthRetrievalError error if the token could not be retrieved.
 */
export type ZoomAccessTokenFactory = () => Promise<ZoomAccessToken>;

/**
 * A ZoomAccessTokenFactory that always generates a new ZoomAccessToken.
 */
export type ZoomAccessTokenRefresher = ZoomAccessTokenFactory;

/**
 * Source for retriving a ZoomAccessToken string.
 *
 * Throws an ZoomOAuthAuthRetrievalError error if the token could not be retrieved.
 */
export type ZoomAccessTokenStringFactory = () => Promise<ZoomAccessTokenString>;

/**
 * Generates a new ZoomAccessTokenStringFactory.
 */
export function zoomAccessTokenStringFactory(zoomAccessTokenFactory: ZoomAccessTokenFactory): ZoomAccessTokenStringFactory {
  return async () => {
    const token = await zoomAccessTokenFactory();

    if (!token?.accessToken) {
      throw new ZoomOAuthAuthFailureError();
    }

    return token.accessToken;
  };
}
