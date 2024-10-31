import { Maybe } from '@dereekb/util';
import { ZohoAccountsAuthFailureError } from './accounts.error.api';
import { ZohoApiServiceName } from '../zoho.config';

/**
 * Arbitrary key used to identify a specific service's access token. Typically coincides with the ZohoApiServiceName.
 *
 * I.E. recruit
 */
export type ZohoServiceAccessTokenKey = ZohoApiServiceName | string;

/**
 * Access token authorization string generated from a refresh token.
 */
export type ZohoAccessTokenString = string;

/**
 * Scopes string for a ZohoAccessToken
 *
 * Example: "ZohoRecruit.modules.ALL"
 */
export type ZohoAccessTokenScopesString = string;

/**
 * Api domain string for a ZohoAccessToken
 *
 * Example: "https://www.zohoapis.com"
 */
export type ZohoAccessTokenApiDomain = string;

/**
 * Zoho account access token.
 */
export interface ZohoAccessToken {
  readonly accessToken: ZohoAccessTokenString;
  readonly scope: ZohoAccessTokenScopesString;
  readonly apiDomain: ZohoAccessTokenApiDomain;
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
 *
 * Throws an ZohoAccountsAuthRetrievalError error if the token could not be retrieved.
 */
export type ZohoAccessTokenFactory = () => Promise<ZohoAccessToken>;

/**
 * A ZohoAccessTokenFactory that always generates a new ZohoAccessToken.
 */
export type ZohoAccessTokenRefresher = ZohoAccessTokenFactory;

/**
 * Source for retriving a ZohoAccessToken string.
 *
 * Throws an ZohoAccountsAuthRetrievalError error if the token could not be retrieved.
 */
export type ZohoAccessTokenStringFactory = () => Promise<ZohoAccessTokenString>;

/**
 * Generates a new ZohoAccessTokenStringFactory.
 */
export function zohoAccessTokenStringFactory(zohoAccessTokenFactory: ZohoAccessTokenFactory): ZohoAccessTokenStringFactory {
  return async () => {
    const token = await zohoAccessTokenFactory();

    if (!token?.accessToken) {
      throw new ZohoAccountsAuthFailureError();
    }

    return token.accessToken;
  };
}
