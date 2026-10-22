import { MS_IN_SECOND, type Maybe, type Seconds } from '@dereekb/util';
import { type TrelloOAuthAccessTokenString } from '../trello.type';
import { type TrelloOAuthTokenResponse } from './oauth.api';
import { TRELLO_OAUTH_REFRESH_TOKEN_LIFETIME } from './oauth.config';

/**
 * A single-use, rotating Trello OAuth 2.0 refresh token.
 */
export type TrelloOAuthRefreshToken = string;

/**
 * Space-separated scopes string for a {@link TrelloOAuthAccessToken}.
 */
export type TrelloOAuthAccessTokenScopesString = string;

/**
 * A normalized Trello OAuth 2.0 access token.
 */
export interface TrelloOAuthAccessToken {
  readonly accessToken: TrelloOAuthAccessTokenString;
  /**
   * Present when `offline_access` was granted. Always the ROTATED token the response carried.
   */
  readonly refreshToken?: Maybe<TrelloOAuthRefreshToken>;
  readonly scope: TrelloOAuthAccessTokenScopesString;
  /**
   * Length of time the access token is valid for. Trello issues one hour.
   */
  readonly expiresIn: Seconds;
  /**
   * Date the access token expires at.
   */
  readonly expiresAt: Date;
  /**
   * Date the refresh token expires at, when there is one.
   *
   * From the response's `refresh_expires_in` when present, else
   * `now + TRELLO_OAUTH_REFRESH_TOKEN_LIFETIME`.
   */
  readonly refreshExpiresAt?: Maybe<Date>;
}

/**
 * Maps a {@link TrelloOAuthTokenResponse} to a {@link TrelloOAuthAccessToken}.
 *
 * @param response - The token response returned by the token endpoint.
 * @returns The equivalent TrelloOAuthAccessToken, with expirations resolved against the current time.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trelloOAuthAccessTokenFromTokenResponse(response: TrelloOAuthTokenResponse): TrelloOAuthAccessToken {
  const createdAt = Date.now();
  const { access_token, refresh_token, scope, expires_in, refresh_expires_in } = response;
  let refreshExpiresAt: Maybe<Date>;

  if (refresh_token) {
    refreshExpiresAt = new Date(createdAt + (refresh_expires_in == null ? TRELLO_OAUTH_REFRESH_TOKEN_LIFETIME : refresh_expires_in * MS_IN_SECOND));
  }

  const accessToken: TrelloOAuthAccessToken = {
    accessToken: access_token,
    refreshToken: refresh_token,
    scope: scope ?? '',
    expiresIn: expires_in,
    expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
    refreshExpiresAt
  };

  return accessToken;
}
