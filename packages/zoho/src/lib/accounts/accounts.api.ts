import { type FetchJsonBody, type FetchJsonInput } from '@dereekb/util/fetch';
import { type ZohoAccountsContext } from './accounts.config';
import { type ZohoAuthClientIdAndSecretPair, type ZohoRefreshToken } from '../zoho.config';
import { type ZohoAccessTokenApiDomain, type ZohoAccessTokenScopesString, type ZohoAccessTokenString } from './accounts';
import { type Maybe, type Seconds } from '@dereekb/util';
import { type ZohoAccountsAccessTokenErrorCode } from './accounts.error.api';

export interface ZohoAccountsAccessTokenInput {
  readonly client?: Maybe<ZohoAuthClientIdAndSecretPair>;
  readonly refreshToken?: Maybe<ZohoRefreshToken>;
}

export interface ZohoAccountsAccessTokenResponse {
  access_token: ZohoAccessTokenString;
  scope: ZohoAccessTokenScopesString;
  api_domain: ZohoAccessTokenApiDomain;
  token_type: 'Bearer';
  expires_in: Seconds;
}

export interface ZohoAccountsAccessTokenErrorResponse {
  error: ZohoAccountsAccessTokenErrorCode;
}

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function zohoAccountsAccessToken(context: ZohoAccountsContext): (input?: ZohoAccountsAccessTokenInput) => Promise<ZohoAccountsAccessTokenResponse> {
  return (input) => {
    const { clientId: configClientId, clientSecret: configClientSecret, refreshToken: configRefreshToken } = context.config;
    const { client, refreshToken: inputRefreshToken } = input ?? {};

    const clientId = client?.clientId ?? configClientId;
    const clientSecret = client?.clientSecret ?? configClientSecret;
    const refreshToken = inputRefreshToken ?? configRefreshToken;

    return context.fetchJson(`/oauth/v2/token?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`, zohoAccountsApiFetchJsonInput('POST'));
  };
}

export function zohoAccountsApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}
