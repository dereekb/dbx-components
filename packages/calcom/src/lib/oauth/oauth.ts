import { type Maybe, type Seconds } from '@dereekb/util';
import { type CalcomRefreshToken } from '../calcom.config';
import { CalcomOAuthAuthFailureError } from './oauth.error.api';

/**
 * Access token authorization string generated from a refresh token.
 */
export type CalcomAccessTokenString = string;

/**
 * Scopes string for a CalcomAccessToken that is space-separated.
 */
export type CalcomAccessTokenScopesString = string;

/**
 * Cal.com account access token.
 */
export interface CalcomAccessToken {
  readonly accessToken: CalcomAccessTokenString;
  readonly scope: CalcomAccessTokenScopesString;
  /**
   * The latest refresh token. Cal.com rotates refresh tokens on every use.
   */
  readonly refreshToken: CalcomRefreshToken;
  /**
   * Length of time the token is valid for.
   */
  readonly expiresIn: Seconds;
  /**
   * Date the token expires at.
   */
  readonly expiresAt: Date;
}

/**
 * Used for retrieving and storing CalcomAccessToken values.
 */
export interface CalcomAccessTokenCache {
  /**
   * Loads the token from the cache, if available.
   *
   * The token may be expired.
   */
  loadCachedToken(): Promise<Maybe<CalcomAccessToken>>;
  /**
   * Updates the cache with the given access token.
   */
  updateCachedToken(accessToken: CalcomAccessToken): Promise<void>;
}

/**
 * Source for retrieving a CalcomAccessToken.
 *
 * Throws a CalcomOAuthAuthFailureError error if the token could not be retrieved.
 */
export type CalcomAccessTokenFactory = () => Promise<CalcomAccessToken>;

/**
 * A CalcomAccessTokenFactory that always generates a new CalcomAccessToken.
 */
export type CalcomAccessTokenRefresher = CalcomAccessTokenFactory;

/**
 * Source for retrieving a CalcomAccessToken string.
 *
 * Throws a CalcomOAuthAuthFailureError error if the token could not be retrieved.
 */
export type CalcomAccessTokenStringFactory = () => Promise<CalcomAccessTokenString>;

/**
 * Generates a new CalcomAccessTokenStringFactory.
 */
export function calcomAccessTokenStringFactory(calcomAccessTokenFactory: CalcomAccessTokenFactory): CalcomAccessTokenStringFactory {
  return async () => {
    const token = await calcomAccessTokenFactory();

    if (!token?.accessToken) {
      throw new CalcomOAuthAuthFailureError();
    }

    return token.accessToken;
  };
}
