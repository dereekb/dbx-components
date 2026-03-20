import { type FetchJsonInput } from '@dereekb/util/fetch';
import { type ZoomOAuthContext } from './oauth.config';
import { type ZoomAccountId, type ZoomAuthClientIdAndSecretPair, type ZoomRefreshToken } from '../zoom.config';
import { type ZoomAccessTokenApiDomain, type ZoomAccessTokenScopesString, type ZoomAccessTokenString } from './oauth';
import { type Maybe, type Seconds } from '@dereekb/util';
import { type ZoomOAuthAccessTokenErrorCode } from './oauth.error.api';

export interface ZoomOAuthServerAccessTokenInput {
  readonly client?: Maybe<ZoomAuthClientIdAndSecretPair>;
  readonly accountId?: Maybe<ZoomAccountId>;
}

export interface ZoomOAuthUserAccessTokenInput extends ZoomOAuthServerAccessTokenInput {
  readonly refreshToken: ZoomRefreshToken;
}

export interface ZoomOAuthAccessTokenResponse {
  readonly access_token: ZoomAccessTokenString;
  readonly token_type: 'bearer';
  readonly api_url: ZoomAccessTokenApiDomain;
  readonly scope: ZoomAccessTokenScopesString;
  readonly expires_in: Seconds;
}

export interface ZoomOAuthAccessTokenErrorResponse {
  readonly error: ZoomOAuthAccessTokenErrorCode;
}

/**
 * Retrieves a new AccessToken for Server to Server authentication.
 *
 * @param context
 * @returns
 */
export function serverAccessToken(context: ZoomOAuthContext): (input?: ZoomOAuthServerAccessTokenInput) => Promise<ZoomOAuthAccessTokenResponse> {
  return (input) => {
    return context.fetchJson(`/token?grant_type=account_credentials&account_id=${input?.accountId ?? context.config.accountId}`, zoomOAuthApiFetchJsonInput(context, input));
  };
}

/**
 * Retrieves a new AccessToken for a user using their refresh token.
 *
 * @param context
 * @returns
 */
export function userAccessToken(context: ZoomOAuthContext): (input: ZoomOAuthUserAccessTokenInput) => Promise<ZoomOAuthAccessTokenResponse> {
  return (input) => {
    const refreshToken = input.refreshToken;
    return context.fetchJson(`/token?grant_type=refresh_token&refresh_token=${refreshToken}`, zoomOAuthApiFetchJsonInput(context, input));
  };
}

/**
 * Builds a FetchJsonInput for Zoom OAuth API calls with Basic auth.
 *
 * @param context The Zoom OAuth context
 * @param input Optional override for client credentials
 * @returns A configured FetchJsonInput for the OAuth API call
 */
export function zoomOAuthApiFetchJsonInput(context: ZoomOAuthContext, input?: Maybe<ZoomOAuthServerAccessTokenInput>): FetchJsonInput {
  const clientId = input?.client?.clientId ?? context.config.clientId;
  const clientSecret = input?.client?.clientSecret ?? context.config.clientSecret;

  const fetchJsonInput: FetchJsonInput = {
    headers: {
      Authorization: zoomOAuthServerBasicAuthorizationHeaderValue({
        clientId,
        clientSecret
      })
    },
    method: 'POST'
  };

  return fetchJsonInput;
}

/**
 * Generates a Basic Authorization header value for Zoom OAuth.
 *
 * @param input The client ID and secret pair
 * @returns The Base64-encoded Basic auth header value
 */
export function zoomOAuthServerBasicAuthorizationHeaderValue(input: ZoomAuthClientIdAndSecretPair) {
  const credentials = input.clientId + ':' + input.clientSecret;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}
