import { type EmailAddress, type Maybe, type Seconds } from '@dereekb/util';
import { type FetchJsonInput } from '@dereekb/util/fetch';
import { TRELLO_OAUTH_API_URL, type TrelloMemberId, type TrelloOAuthAccessTokenString, type TrelloUsername } from '../trello.type';
import { TRELLO_OAUTH_TOKEN_URL, type TrelloOAuthContext } from './oauth.config';
import { type TrelloOAuthRefreshToken } from './oauth';

/**
 * The fields the connect-time member read asks for.
 */
export const TRELLO_OAUTH_CURRENT_MEMBER_FIELDS = 'id,username,fullName,email';

export interface TrelloOAuthExchangeAuthorizationCodeInput {
  readonly code: string;
  /**
   * Must be byte-identical to the `redirect_uri` sent on the authorize request.
   */
  readonly redirectUri: string;
  /**
   * The PKCE code verifier whose challenge the authorize request carried. Trello requires PKCE on every
   * code grant, so this is required.
   */
  readonly codeVerifier: string;
}

export interface TrelloOAuthRefreshTokenInput {
  /**
   * The refresh token to exchange. Single-use: Trello rotates it on every refresh, and treats reuse as
   * a potential breach — so always persist the rotated one the response carries.
   */
  readonly refreshToken: TrelloOAuthRefreshToken;
}

export interface TrelloOAuthReadCurrentMemberInput {
  /**
   * The member's OAuth 2.0 access token. NOT the client credentials.
   */
  readonly accessToken: TrelloOAuthAccessTokenString;
}

/**
 * The token endpoint's response, for both the code exchange and a refresh.
 */
export interface TrelloOAuthTokenResponse {
  readonly access_token: TrelloOAuthAccessTokenString;
  /**
   * Present when `offline_access` was granted. A refresh returns a NEW one — the sent token is spent.
   */
  readonly refresh_token?: Maybe<TrelloOAuthRefreshToken>;
  readonly token_type: string;
  /**
   * Seconds until the access token expires. Trello issues 3600.
   */
  readonly expires_in: Seconds;
  /**
   * The granted scopes, space-delimited.
   */
  readonly scope?: Maybe<string>;
  /**
   * Seconds until the refresh token expires, when the server reports it. Wins over
   * `TRELLO_OAUTH_REFRESH_TOKEN_LIFETIME`.
   */
  readonly refresh_expires_in?: Maybe<Seconds>;
}

/**
 * The subset of Trello's member object the connect-time identity read returns.
 */
export interface TrelloOAuthCurrentMember {
  /**
   * The member's 24-hex id. Stable — the identity to key on.
   */
  readonly id: TrelloMemberId;
  /**
   * The member's username. Mutable: never an identity.
   */
  readonly username: TrelloUsername;
  readonly fullName?: Maybe<string>;
  /**
   * Present when `read:member:trello` was granted and Trello exposes it.
   */
  readonly email?: Maybe<EmailAddress>;
}

/**
 * Exchanges an OAuth 2.0 authorization code for access and refresh tokens.
 *
 * Posts a JSON body carrying the client credentials and the PKCE verifier, as Trello's confidential
 * client guide specifies. `@dereekb/util/oidc` is form-encoded only, so this composes the body itself,
 * like Cal.com's client.
 *
 * @param context - The Trello OAuth context providing the configured fetch and client credentials.
 * @returns Exchanges an authorization code for access and refresh tokens.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/
 */
export function exchangeAuthorizationCode(context: TrelloOAuthContext): (input: TrelloOAuthExchangeAuthorizationCodeInput) => Promise<TrelloOAuthTokenResponse> {
  const { clientId, clientSecret } = context.config;

  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier
      })
    };

    return context.fetchJson(TRELLO_OAUTH_TOKEN_URL, fetchJsonInput);
  };
}

/**
 * Refreshes an access token.
 *
 * Trello's refresh tokens are single-use: the response carries a rotated `refresh_token` that must be
 * persisted, and re-presenting the spent one outside Atlassian's reuse leeway may be treated as a
 * breach.
 *
 * @param context - The Trello OAuth context providing the configured fetch and client credentials.
 * @returns Refreshes an access token using the given refresh token.
 */
export function refreshAccessToken(context: TrelloOAuthContext): (input: TrelloOAuthRefreshTokenInput) => Promise<TrelloOAuthTokenResponse> {
  const { clientId, clientSecret } = context.config;

  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: input.refreshToken
      })
    };

    return context.fetchJson(TRELLO_OAUTH_TOKEN_URL, fetchJsonInput);
  };
}

/**
 * Reads the member an OAuth 2.0 access token belongs to. Requires `read:member:trello`.
 *
 * Bearer-authenticated with the MEMBER's token on {@link TRELLO_OAUTH_API_URL}. Trello rate-limits
 * `/1/members/` to 100 requests per 900 seconds, so this is read on connect only — never on refresh.
 *
 * @param context - The Trello OAuth context providing the configured fetch.
 * @returns Reads the member the given access token belongs to.
 */
export function readCurrentMember(context: TrelloOAuthContext): (input: TrelloOAuthReadCurrentMemberInput) => Promise<TrelloOAuthCurrentMember> {
  return (input) => {
    const fetchJsonInput: FetchJsonInput = {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.accessToken}`
      }
    };

    return context.fetchJson(`${TRELLO_OAUTH_API_URL}/members/me?fields=${TRELLO_OAUTH_CURRENT_MEMBER_FIELDS}`, fetchJsonInput);
  };
}
