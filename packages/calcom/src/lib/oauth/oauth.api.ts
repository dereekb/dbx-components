import { type FetchJsonInput } from '@dereekb/util/fetch';
import { type CalcomOAuthContext } from './oauth.config';
import { type CalcomRefreshToken } from '../calcom.config';
import { type CalcomAccessTokenScopesString, type CalcomAccessTokenString } from './oauth';
import { type Maybe, type Seconds } from '@dereekb/util';

export interface CalcomOAuthRefreshTokenInput {
  readonly refreshToken?: Maybe<CalcomRefreshToken>;
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
 * Retrieves a new AccessToken using a refresh token.
 *
 * Cal.com uses JSON body (not Basic Auth) for token requests.
 */
export function refreshAccessToken(context: CalcomOAuthContext): (input?: CalcomOAuthRefreshTokenInput) => Promise<CalcomOAuthTokenResponse> {
  return (input) => {
    const refreshToken = input?.refreshToken ?? context.config.refreshToken;

    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: context.config.clientId,
        client_secret: context.config.clientSecret,
        refresh_token: refreshToken
      })
    };

    return context.fetchJson('/oauth/token', fetchJsonInput);
  };
}

/**
 * Exchanges an authorization code for an access token.
 *
 * Cal.com uses JSON body (not Basic Auth) for token requests.
 */
export function exchangeAuthorizationCode(context: CalcomOAuthContext): (input: CalcomOAuthExchangeAuthorizationCodeInput) => Promise<CalcomOAuthTokenResponse> {
  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: context.config.clientId,
        client_secret: context.config.clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri
      })
    };

    return context.fetchJson('/oauth/token', fetchJsonInput);
  };
}
