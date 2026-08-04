import { MS_IN_SECOND, type Seconds } from '@dereekb/util';
import { type DiscordOAuthTokenResponse } from './oauth.api';

/**
 * Access token string issued by Discord's token endpoint.
 */
export type DiscordAccessTokenString = string;

/**
 * Space-separated scopes string for a {@link DiscordAccessToken}.
 */
export type DiscordAccessTokenScopesString = string;

/**
 * Refresh token issued alongside a Discord access token.
 *
 * Discord's refresh response returns a refresh token of its own, so always persist the latest one
 * rather than assuming the sent value survives.
 */
export type DiscordRefreshToken = string;

/**
 * A normalized Discord account access token.
 */
export interface DiscordAccessToken {
  readonly accessToken: DiscordAccessTokenString;
  readonly refreshToken: DiscordRefreshToken;
  readonly scope: DiscordAccessTokenScopesString;
  /**
   * Length of time the token is valid for. Discord issues 7 days.
   */
  readonly expiresIn: Seconds;
  /**
   * Date the token expires at.
   */
  readonly expiresAt: Date;
}

/**
 * Maps a {@link DiscordOAuthTokenResponse} to a {@link DiscordAccessToken}.
 *
 * @param response - The token response returned by the Discord token endpoint.
 * @returns The equivalent DiscordAccessToken, with `expiresAt` resolved against the current time.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function discordAccessTokenFromTokenResponse(response: DiscordOAuthTokenResponse): DiscordAccessToken {
  const createdAt = Date.now();
  const { access_token, refresh_token, scope, expires_in } = response;

  const accessToken: DiscordAccessToken = {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND),
    scope: scope ?? ''
  };

  return accessToken;
}
