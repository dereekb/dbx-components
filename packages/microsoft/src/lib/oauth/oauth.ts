import { MS_IN_SECOND, type Maybe, type Seconds } from '@dereekb/util';
import { type MicrosoftOAuthTokenResponse } from './oauth.api';
import { type MicrosoftGraphScope, microsoftGraphScopesFromScopeString } from './oauth.scope';

/**
 * A normalized Microsoft access token.
 */
export interface MicrosoftOAuthAccessToken {
  readonly accessToken: string;
  /**
   * The rotated refresh token. Absent when `offline_access` was not granted.
   */
  readonly refreshToken?: Maybe<string>;
  /**
   * The OIDC id token, present on a code exchange that requested `openid`.
   */
  readonly idToken?: Maybe<string>;
  /**
   * The granted Graph scopes, normalised (canonical casing, no resource prefix, no OIDC scopes).
   */
  readonly scopes: MicrosoftGraphScope[];
  readonly expiresIn: Seconds;
  readonly expiresAt: Date;
}

/**
 * Maps a {@link MicrosoftOAuthTokenResponse} to a {@link MicrosoftOAuthAccessToken}.
 *
 * @param response - The token endpoint's response.
 * @returns The normalized token, with `expiresAt` resolved against the current time.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function microsoftOAuthAccessTokenFromTokenResponse(response: MicrosoftOAuthTokenResponse): MicrosoftOAuthAccessToken {
  const createdAt = Date.now();
  const { access_token, refresh_token, id_token, scope, expires_in } = response;

  return {
    accessToken: access_token,
    refreshToken: refresh_token ?? undefined,
    idToken: id_token ?? undefined,
    scopes: microsoftGraphScopesFromScopeString(scope),
    expiresIn: expires_in,
    expiresAt: new Date(createdAt + expires_in * MS_IN_SECOND)
  };
}
