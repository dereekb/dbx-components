import { type FetchJsonBody, type FetchJsonInput, makeUrlSearchParams } from '@dereekb/util/fetch';
import { type ZohoAccountsContext } from './accounts.config';
import { type ZohoAuthClientIdAndSecretPair, type ZohoRefreshToken } from '../zoho.config';
import { type ZohoAccessTokenApiDomain, type ZohoAccessTokenScopesString, type ZohoAccessTokenString } from './accounts';
import { type Maybe, type Seconds } from '@dereekb/util';
import { type ZohoAccountsAccessTokenErrorCode } from './accounts.error.api';

/**
 * Optional overrides for the access token request. When omitted, values
 * are read from the {@link ZohoAccountsContext}'s config.
 */
export interface ZohoAccountsAccessTokenInput {
  /**
   * Override client credentials. Falls back to the context config's `clientId`/`clientSecret`.
   */
  readonly client?: Maybe<ZohoAuthClientIdAndSecretPair>;
  /**
   * Override refresh token. Falls back to the context config's `refreshToken`.
   */
  readonly refreshToken?: Maybe<ZohoRefreshToken>;
}

/**
 * Successful response from the Zoho OAuth `/oauth/v2/token` endpoint
 * when exchanging a refresh token for a new access token.
 */
export interface ZohoAccountsAccessTokenResponse {
  /**
   * Short-lived OAuth access token for authenticating API calls.
   */
  readonly access_token: ZohoAccessTokenString;
  /**
   * Comma-separated list of OAuth scopes granted to this token.
   */
  readonly scope: ZohoAccessTokenScopesString;
  /**
   * The API domain to use for subsequent API calls (e.g. `'https://www.zohoapis.com'`).
   */
  readonly api_domain: ZohoAccessTokenApiDomain;
  /**
   * Token type, always `'Bearer'`.
   */
  readonly token_type: 'Bearer';
  /**
   * Number of seconds until the access token expires.
   */
  readonly expires_in: Seconds;
}

/**
 * Error response from the Zoho OAuth token endpoint when the refresh fails.
 */
export interface ZohoAccountsAccessTokenErrorResponse {
  /**
   * Error code indicating the reason for failure (e.g. `'invalid_code'`, `'invalid_client'`).
   */
  error: ZohoAccountsAccessTokenErrorCode;
}

/**
 * Creates a function that exchanges a refresh token for a new short-lived access token
 * via the Zoho OAuth `/oauth/v2/token` endpoint.
 *
 * The returned function accepts optional overrides for client credentials and refresh token.
 * When omitted, values are read from the {@link ZohoAccountsContext}'s config.
 *
 * @param context - Authenticated Zoho Accounts context providing fetch and config
 * @returns Function that exchanges a refresh token for an access token
 *
 * @example
 * ```typescript
 * const getAccessToken = zohoAccountsAccessToken(accountsContext);
 *
 * // Using config defaults:
 * const { access_token, expires_in } = await getAccessToken();
 *
 * // With overrides:
 * const response = await getAccessToken({
 *   client: { clientId: 'other-id', clientSecret: 'other-secret' },
 *   refreshToken: 'other-refresh-token'
 * });
 * ```
 *
 * @see https://www.zoho.com/accounts/protocol/oauth/web-apps/access-token-expiry.html
 */
export function zohoAccountsAccessToken(context: ZohoAccountsContext): (input?: ZohoAccountsAccessTokenInput) => Promise<ZohoAccountsAccessTokenResponse> {
  return (input) => {
    const { clientId: configClientId, clientSecret: configClientSecret, refreshToken: configRefreshToken } = context.config;
    const { client, refreshToken: inputRefreshToken } = input ?? {};

    const clientId = client?.clientId ?? configClientId;
    const clientSecret = client?.clientSecret ?? configClientSecret;
    const refreshToken = inputRefreshToken ?? configRefreshToken;

    const params = makeUrlSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken
    });

    return context.fetchJson(`/oauth/v2/token?${params}`, zohoAccountsApiFetchJsonInput('POST'));
  };
}

// MARK: Authorization Code → Refresh Token
/**
 * OAuth authorization code received from the Zoho authorization server
 * after the user grants consent. Single-use and short-lived.
 */
export type ZohoAuthorizationCode = string;

/**
 * Input for exchanging an authorization code for a refresh token and initial access token.
 */
export interface ZohoAccountsRefreshTokenFromAuthorizationCodeInput {
  /**
   * Override client credentials. Falls back to the context config's `clientId`/`clientSecret`.
   */
  readonly client?: Maybe<ZohoAuthClientIdAndSecretPair>;
  /**
   * The single-use authorization code obtained from the Zoho consent flow.
   */
  readonly code: ZohoAuthorizationCode;
  /**
   * The redirect URI registered in the Zoho API console.
   * Must exactly match the URI used during the authorization request.
   */
  readonly redirectUri: string;
}

/**
 * Successful response from the Zoho OAuth `/oauth/v2/token` endpoint
 * when exchanging an authorization code for tokens.
 */
export interface ZohoAccountsRefreshTokenFromAuthorizationCodeResponse {
  /**
   * Short-lived OAuth access token for authenticating API calls.
   */
  readonly access_token: ZohoAccessTokenString;
  /**
   * Long-lived refresh token for obtaining new access tokens.
   * Only included if `access_type=offline` was passed during the authorization request.
   */
  readonly refresh_token?: ZohoRefreshToken;
  /**
   * Comma-separated list of OAuth scopes granted to this token.
   */
  readonly scope: ZohoAccessTokenScopesString;
  /**
   * The API domain to use for subsequent API calls (e.g. `'https://www.zohoapis.com'`).
   */
  readonly api_domain: ZohoAccessTokenApiDomain;
  /**
   * Token type, always `'Bearer'`.
   */
  readonly token_type: 'Bearer';
  /**
   * Number of seconds until the access token expires (typically 3600).
   */
  readonly expires_in: Seconds;
}

/**
 * Exchanges a single-use authorization code for tokens.
 */
export type ZohoAccountsRefreshTokenFromAuthorizationCodeFunction = (input: ZohoAccountsRefreshTokenFromAuthorizationCodeInput) => Promise<ZohoAccountsRefreshTokenFromAuthorizationCodeResponse>;

/**
 * Creates a function that exchanges a single-use OAuth authorization code for
 * an access token and (optionally) a long-lived refresh token via the Zoho
 * `/oauth/v2/token` endpoint with `grant_type=authorization_code`.
 *
 * This is the second step of the Zoho OAuth 2.0 web server flow:
 * 1. Redirect the user to Zoho's consent page to obtain an authorization code
 * 2. Exchange the authorization code for tokens using this function
 * 3. Use the refresh token with {@link zohoAccountsAccessToken} to obtain new access tokens
 *
 * The refresh token is only returned if `access_type=offline` was passed during
 * the initial authorization request.
 *
 * @param context - Zoho Accounts context providing fetch and config (clientId/clientSecret)
 * @returns Function that exchanges an authorization code for tokens
 *
 * @example
 * ```typescript
 * const exchangeCode = zohoAccountsRefreshTokenFromAuthorizationCode(accountsContext);
 *
 * const { access_token, refresh_token } = await exchangeCode({
 *   code: '1000.abc123.def456',
 *   redirectUri: 'https://myapp.example.com/oauth/callback'
 * });
 * ```
 *
 * @see https://www.zoho.com/accounts/protocol/oauth/web-apps/access-token.html
 */
export function zohoAccountsRefreshTokenFromAuthorizationCode(context: ZohoAccountsContext): ZohoAccountsRefreshTokenFromAuthorizationCodeFunction {
  return (input: ZohoAccountsRefreshTokenFromAuthorizationCodeInput) => {
    const { clientId: configClientId, clientSecret: configClientSecret } = context.config;
    const { client, code, redirectUri } = input;

    const clientId = client?.clientId ?? configClientId;
    const clientSecret = client?.clientSecret ?? configClientSecret;

    const params = makeUrlSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    });

    return context.fetchJson<ZohoAccountsRefreshTokenFromAuthorizationCodeResponse>(`/oauth/v2/token?${params}`, zohoAccountsApiFetchJsonInput('POST'));
  };
}

/**
 * Constructs a standard {@link FetchJsonInput} for Zoho Accounts API calls with the given HTTP method and optional body.
 *
 * @param method - HTTP method to use for the request
 * @param body - Optional request body to include
 * @returns Configured fetch input for the Zoho Accounts API call
 */
export function zohoAccountsApiFetchJsonInput(method: string, body?: FetchJsonBody): FetchJsonInput {
  return {
    method,
    body
  };
}
