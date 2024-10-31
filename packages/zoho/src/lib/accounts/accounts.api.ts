import { FetchJsonBody, FetchJsonInput } from '@dereekb/util/fetch';
import { ZohoAccountsContext } from './accounts.config';
import { ZohoAuthClientIdAndSecretPair, ZohoRefreshToken } from '../zoho.config';
import { ZohoAccessTokenApiDomain, ZohoAccessTokenScopesString, ZohoAccessTokenString } from './accounts';
import { Maybe, Seconds } from '@dereekb/util';
import { ZohoAccountsAccessTokenError, ZohoAccountsAccessTokenErrorCode } from './accounts.error.api';

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
export function accessToken(context: ZohoAccountsContext): (input?: ZohoAccountsAccessTokenInput) => Promise<ZohoAccountsAccessTokenResponse> {
  return (input) =>
    context.fetchJson<ZohoAccountsAccessTokenResponse | ZohoAccountsAccessTokenErrorResponse>(`/oauth/v2/token?grant_type=refresh_token&client_id=${input?.client?.clientId ?? context.config.clientId}&client_secret=${input?.client?.clientSecret ?? context.config.clientSecret}&refresh_token=${input?.refreshToken ?? context.config.refreshToken}`, zohoAccountsApiFetchJsonInput('POST')).then((result) => {
      if ((result as ZohoAccountsAccessTokenErrorResponse)?.error) {
        throw new ZohoAccountsAccessTokenError((result as ZohoAccountsAccessTokenErrorResponse).error);
      }

      return result as ZohoAccountsAccessTokenResponse;
    });
}

export function zohoAccountsApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  const result = {
    method,
    body
  };

  return result;
}
