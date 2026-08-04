import { type FetchJsonInput } from '@dereekb/util/fetch';
import { CALCOM_OAUTH_TOKEN_PATH, type CalcomOAuthContext } from './oauth.config';
import { type CalcomRefreshToken } from '../calcom.config';
import { type CalcomAccessTokenScopesString, type CalcomAccessTokenString } from './oauth';
import { type Seconds } from '@dereekb/util';

export interface CalcomOAuthRefreshTokenInput {
  /**
   * The refresh token to exchange.
   *
   * Required, and deliberately not defaulted from the context's configuration: Cal.com rotates
   * refresh tokens on every use, so the configured value is spent the first time the context
   * refreshes. Every caller therefore has to name the token it actually holds.
   */
  readonly refreshToken: CalcomRefreshToken;
}

export interface CalcomOAuthExchangeAuthorizationCodeInput {
  readonly code: string;
  readonly redirectUri: string;
}

export interface CalcomOAuthTokenResponse {
  readonly access_token: CalcomAccessTokenString;
  readonly refresh_token: CalcomRefreshToken;
  readonly token_type: 'Bearer';
  readonly expires_in: Seconds;
  readonly scope?: CalcomAccessTokenScopesString;
}

export interface CalcomOAuthAccessTokenErrorResponse {
  readonly error: string;
}

/**
 * Refreshes an access token using a refresh token. Cal.com rotates refresh tokens
 * on every use, so the new `refresh_token` from the response must be persisted.
 *
 * Cal.com uses JSON body (not Basic Auth) for token requests.
 *
 * @param context - The Cal.com OAuth context providing client credentials and fetch capabilities.
 * @returns Refreshes an access token using the given refresh token.
 *
 * @see https://cal.com/docs/api-reference/v2/oauth/refresh-an-existing-access-token
 *
 * @example
 * ```ts
 * const response = await refreshAccessToken(context)({ refreshToken: 'existing-refresh-token' });
 * console.log(response.access_token, response.refresh_token);
 * ```
 */
export function refreshAccessToken(context: CalcomOAuthContext): (input: CalcomOAuthRefreshTokenInput) => Promise<CalcomOAuthTokenResponse> {
  const { client } = context.config;

  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: client?.clientId,
        client_secret: client?.clientSecret,
        refresh_token: input.refreshToken
      })
    };

    return context.fetchJson(CALCOM_OAUTH_TOKEN_PATH, fetchJsonInput);
  };
}

/**
 * Exchanges an OAuth authorization code for access and refresh tokens.
 * Used during the initial OAuth flow when a user authorizes your app.
 *
 * Cal.com uses JSON body (not Basic Auth) for token requests.
 *
 * @param context - The Cal.com OAuth context providing client credentials and fetch capabilities.
 * @returns Exchanges an authorization code for access and refresh tokens.
 *
 * @see https://cal.com/docs/api-reference/v2/oauth/exchange-an-authorization-code-for-access-tokens
 *
 * @example
 * ```ts
 * const response = await exchangeAuthorizationCode(context)({
 *   code: 'auth-code-from-redirect',
 *   redirectUri: 'https://example.com/callback'
 * });
 * console.log(response.access_token, response.refresh_token);
 * ```
 */
export function exchangeAuthorizationCode(context: CalcomOAuthContext): (input: CalcomOAuthExchangeAuthorizationCodeInput) => Promise<CalcomOAuthTokenResponse> {
  const { client } = context.config;

  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: client?.clientId,
        client_secret: client?.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri
      })
    };

    return context.fetchJson(CALCOM_OAUTH_TOKEN_PATH, fetchJsonInput);
  };
}
