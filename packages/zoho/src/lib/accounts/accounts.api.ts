import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoAccountsContext } from './accounts.config';
import { ZohoAuthClientIdAndSecretPair, ZohoRefreshToken } from '../zoho.config';
import { ZohoAccessTokenApiDomain, ZohoAccessTokenScopesString, ZohoAccessTokenString } from './accounts';
import { Maybe, Seconds } from '@dereekb/util';

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

/**
 * Trades a refresh token for a new AccessToken
 * @param context
 * @returns
 */
export function zohoAccountsAccessToken(context: ZohoAccountsContext): (input?: ZohoAccountsAccessTokenInput) => Promise<ZohoAccountsAccessTokenResponse> {
  return (input) =>
    context.fetchJson(
      '/oauth/v2/token',
      zohoAccountsApiFetchJsonInput(
        'POST',
        new URLSearchParams([
          ['grant_type', 'refresh_token'],
          ['client_id', input?.client?.clientId ?? context.config.clientId],
          ['client_secret', input?.client?.clientSecret ?? context.config.clientSecret],
          ['refresh_token', input?.refreshToken ?? context.config.refreshToken]
        ])
      )
    );
}

export function zohoAccountsApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}
