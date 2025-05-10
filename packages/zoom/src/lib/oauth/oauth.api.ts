import { FetchJsonInput } from '@dereekb/util/fetch';
import { ZoomOAuthContext } from './oauth.config';
import { ZoomAccountId, ZoomAuthClientIdAndSecretPair, ZoomRefreshToken } from '../zoom.config';
import { ZoomAccessTokenApiDomain, ZoomAccessTokenScopesString, ZoomAccessTokenString } from './oauth';
import { Maybe, Seconds } from '@dereekb/util';
import { ZoomOAuthAccessTokenErrorCode } from './oauth.error.api';

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

export function zoomOAuthServerBasicAuthorizationHeaderValue(input: ZoomAuthClientIdAndSecretPair) {
  return `Basic ${Buffer.from(`${input.clientId}:${input.clientSecret}`).toString('base64')}`;
}
