import { type EmailAddress, type Maybe, type Seconds } from '@dereekb/util';
import { type FetchJsonInput } from '@dereekb/util/fetch';
import { exchangeAuthorizationCode as exchangeOidcAuthorizationCode, refreshAccessToken as refreshOidcAccessToken } from '@dereekb/util/oidc';
import { MICROSOFT_GRAPH_API_URL } from '../microsoft.config';
import { MICROSOFT_OAUTH_SCOPE_DELIMITER } from './oauth.authorize';
import { MICROSOFT_OAUTH_CLIENT_AUTH_METHOD, MICROSOFT_OAUTH_TOKEN_PATH, type MicrosoftOAuthContext } from './oauth.config';
import { MICROSOFT_OFFLINE_ACCESS_SCOPE, type MicrosoftGraphScope, normalizeMicrosoftGraphScopes } from './oauth.scope';

/**
 * The `Content-Type` the token endpoint requires.
 */
export const MICROSOFT_OAUTH_TOKEN_CONTENT_TYPE = 'application/x-www-form-urlencoded';

/**
 * The Graph URL {@link readCurrentUser} reads. Absolute, so it bypasses the OAuth fetch's per-tenant
 * base URL.
 */
export const MICROSOFT_OAUTH_CURRENT_USER_URL = `${MICROSOFT_GRAPH_API_URL}/me?$select=id,displayName,userPrincipalName,mail`;

export interface MicrosoftOAuthExchangeAuthorizationCodeInput {
  readonly code: string;
  /**
   * Must be identical to the `redirect_uri` sent on the authorize request.
   */
  readonly redirectUri: string;
  /**
   * The PKCE code verifier whose challenge was sent on the authorize request.
   */
  readonly codeVerifier?: Maybe<string>;
}

export interface MicrosoftOAuthRefreshTokenInput {
  readonly refreshToken: string;
  /**
   * Optional subset of the consented Graph scopes to name in the refresh request.
   *
   * When set, the request's `scope` is these scopes plus `offline_access` (so a refresh token still
   * comes back). It does NOT narrow the token: Entra accepts the subset but issues a token carrying
   * every scope consented for the resource, and its response `scope` says so. Read the granted scopes
   * from the response rather than assuming the requested ones.
   */
  readonly scopes?: Maybe<readonly MicrosoftGraphScope[]>;
}

export interface MicrosoftOAuthReadCurrentUserInput {
  /**
   * The user's access token. Must carry `User.Read`.
   */
  readonly accessToken: string;
}

/**
 * The token endpoint's response.
 *
 * @see https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
 */
export interface MicrosoftOAuthTokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: Seconds;
  /**
   * Microsoft rotates refresh tokens on every redemption. Present when `offline_access` was granted.
   */
  readonly refresh_token?: Maybe<string>;
  /**
   * Present when `openid` was requested.
   */
  readonly id_token?: Maybe<string>;
  /**
   * The granted scopes, space-delimited. Graph scopes may come back fully-qualified
   * (`https://graph.microsoft.com/Mail.Read`).
   */
  readonly scope?: Maybe<string>;
}

/**
 * The subset of the Graph user object {@link readCurrentUser} selects.
 */
export interface MicrosoftOAuthCurrentUser {
  /**
   * The user's object id within the tenant. Stable; the account identity.
   */
  readonly id: string;
  readonly displayName?: Maybe<string>;
  readonly userPrincipalName?: Maybe<string>;
  readonly mail?: Maybe<EmailAddress>;
}

/**
 * Exchanges an authorization code for access, refresh and id tokens.
 *
 * @param context - The Microsoft OAuth context providing the per-tenant fetch.
 * @returns Exchanges an authorization code for tokens.
 */
export function exchangeAuthorizationCode(context: MicrosoftOAuthContext): (input: MicrosoftOAuthExchangeAuthorizationCodeInput) => Promise<MicrosoftOAuthTokenResponse> {
  return async (input) => {
    const response = await exchangeOidcAuthorizationCode({
      fetch: context.fetch,
      tokenEndpoint: MICROSOFT_OAUTH_TOKEN_PATH,
      clientId: context.config.clientId,
      clientSecret: context.config.clientSecret,
      clientAuth: MICROSOFT_OAUTH_CLIENT_AUTH_METHOD,
      redirectUri: input.redirectUri,
      code: input.code,
      codeVerifier: input.codeVerifier
    });

    return response as MicrosoftOAuthTokenResponse;
  };
}

/**
 * Redeems a refresh token for a new access token. A requested scope subset does not narrow it: the
 * token carries every scope consented for the resource.
 *
 * The response carries a ROTATED refresh token. The old one stays valid until it expires (Microsoft does
 * not revoke a redeemed refresh token), so persisting the rotated one is good hygiene rather than a
 * correctness requirement.
 *
 * @param context - The Microsoft OAuth context providing the per-tenant fetch.
 * @returns Refreshes an access token.
 */
export function refreshAccessToken(context: MicrosoftOAuthContext): (input: MicrosoftOAuthRefreshTokenInput) => Promise<MicrosoftOAuthTokenResponse> {
  return async (input) => {
    const scope = input.scopes?.length ? normalizeMicrosoftGraphScopes([...input.scopes, MICROSOFT_OFFLINE_ACCESS_SCOPE]).join(MICROSOFT_OAUTH_SCOPE_DELIMITER) : undefined;

    const response = await refreshOidcAccessToken({
      fetch: context.fetch,
      tokenEndpoint: MICROSOFT_OAUTH_TOKEN_PATH,
      clientId: context.config.clientId,
      clientSecret: context.config.clientSecret,
      clientAuth: MICROSOFT_OAUTH_CLIENT_AUTH_METHOD,
      refreshToken: input.refreshToken,
      scope
    });

    return response as MicrosoftOAuthTokenResponse;
  };
}

/**
 * Reads the Graph user an access token belongs to (`GET /me`). Requires `User.Read`.
 *
 * Bearer-authenticated with the USER's token; the absolute Graph URL bypasses the OAuth fetch's
 * per-tenant base URL.
 *
 * Entra has no per-grant revoke endpoint, so this package exports no revoke function.
 *
 * @param context - The Microsoft OAuth context providing the fetch.
 * @returns Reads the Graph user the given access token belongs to.
 */
export function readCurrentUser(context: MicrosoftOAuthContext): (input: MicrosoftOAuthReadCurrentUserInput) => Promise<MicrosoftOAuthCurrentUser> {
  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.accessToken}`
      }
    };

    return context.fetchJson(MICROSOFT_OAUTH_CURRENT_USER_URL, fetchJsonInput);
  };
}
