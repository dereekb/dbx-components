import { type Maybe, type WebsiteUrl } from '@dereekb/util';
import { TRELLO_OAUTH_AUTHORIZE_URL, type TrelloOAuthClientId } from './oauth.config';

/**
 * Every scope Trello's OAuth 2.0 client configuration offers, plus `offline_access`.
 *
 * A runtime list rather than a bare type union, so a configured scope can be validated instead of
 * being passed through to the consent screen and refused there.
 *
 * `offline_access` is not part of the client configuration but must be requested to receive a refresh
 * token. The board and organization scopes are "workspace restricted": the consent screen may bind
 * the grant to one Trello workspace.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-client-configuration/
 */
export const ALL_TRELLO_OAUTH_SCOPES = [
  'read:board:trello',
  'write:board:trello',
  'write:board:membership:trello',
  'read:organization:trello',
  'write:organization:trello',
  'write:organization:membership:trello',
  'read:member:trello',
  'write:member:trello',
  'read:enterprise:trello',
  'write:enterprise:trello',
  'offline_access'
] as const;

/**
 * A Trello OAuth 2.0 scope.
 */
export type TrelloOAuthScope = (typeof ALL_TRELLO_OAUTH_SCOPES)[number];

/**
 * Requests a refresh token alongside the access token.
 */
export const TRELLO_OAUTH_OFFLINE_ACCESS_SCOPE: TrelloOAuthScope = 'offline_access';

/**
 * Reads the member's email address, public name, avatar and memberships — what `/1/members/me` needs.
 */
export const TRELLO_OAUTH_READ_MEMBER_SCOPE: TrelloOAuthScope = 'read:member:trello';

/**
 * Reads boards, lists and cards.
 */
export const TRELLO_OAUTH_READ_BOARD_SCOPE: TrelloOAuthScope = 'read:board:trello';

/**
 * Writes boards, lists and cards.
 */
export const TRELLO_OAUTH_WRITE_BOARD_SCOPE: TrelloOAuthScope = 'write:board:trello';

/**
 * Returns whether the input is a known {@link TrelloOAuthScope}.
 *
 * @param value - The value to check.
 * @returns True when the value is a Trello OAuth 2.0 scope.
 */
export function isTrelloOAuthScope(value: string): value is TrelloOAuthScope {
  return (ALL_TRELLO_OAUTH_SCOPES as readonly string[]).includes(value);
}

/**
 * The delimiter used to join scopes in the `scope` query parameter, and to split the `scope` a token
 * response reports.
 */
export const TRELLO_OAUTH_SCOPE_DELIMITER = ' ';

/**
 * The `response_type` used by the authorization-code flow.
 */
export const TRELLO_OAUTH_AUTHORIZE_RESPONSE_TYPE = 'code';

/**
 * The PKCE challenge method. Trello requires S256 on every code grant.
 */
export const TRELLO_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD = 'S256';

/**
 * The `prompt` sent on every authorize request.
 *
 * Always `consent`, so a retried connect re-issues tokens rather than failing silently.
 */
export const TRELLO_OAUTH_AUTHORIZE_PROMPT = 'consent';

export interface TrelloOAuthAuthorizeUrlFactoryConfig {
  /**
   * The OAuth client id to authorize as.
   */
  readonly clientId: TrelloOAuthClientId;
  /**
   * The redirect URI to return to after the user consents.
   *
   * Must match a callback URL registered on the Trello OAuth 2.0 client byte-for-byte, and must be
   * identical to the `redirectUri` later passed to the token exchange.
   */
  readonly redirectUri: WebsiteUrl;
  /**
   * The scopes to request. Include `offline_access` to receive a refresh token.
   */
  readonly scopes: readonly TrelloOAuthScope[];
  /**
   * Optional override of the authorize URL. Defaults to {@link TRELLO_OAUTH_AUTHORIZE_URL}.
   */
  readonly authorizeUrl?: Maybe<WebsiteUrl>;
  /**
   * Optional `audience` parameter.
   *
   * Trello's parameter table does not list it (Jira's 3LO requires `audience=api.atlassian.com`), so it
   * is omitted unless configured here.
   */
  readonly audience?: Maybe<string>;
}

export interface TrelloOAuthAuthorizeUrlParams {
  /**
   * Opaque state echoed back to the redirect URI.
   */
  readonly state?: Maybe<string>;
  /**
   * The PKCE S256 code challenge. Trello requires one on every code grant, so every authorization
   * should set it.
   */
  readonly codeChallenge?: Maybe<string>;
}

export type TrelloOAuthAuthorizeUrlFactory = (params?: Maybe<TrelloOAuthAuthorizeUrlParams>) => WebsiteUrl;

/**
 * Creates a {@link TrelloOAuthAuthorizeUrlFactory} that composes the Atlassian authorize URL a user's
 * browser is redirected to in order to begin Trello's authorization-code flow.
 *
 * Always sets `response_type=code`, `prompt=consent` and the space-joined `scope`. Sets
 * `code_challenge` + `code_challenge_method=S256` when a challenge is given, and `audience` only when
 * configured.
 *
 * @param config - The client id, redirect URI, scopes, and optional authorize URL / audience.
 * @returns A factory that builds an authorize URL for the given params.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/
 *
 * @__NO_SIDE_EFFECTS__
 */
export function trelloOAuthAuthorizeUrlFactory(config: TrelloOAuthAuthorizeUrlFactoryConfig): TrelloOAuthAuthorizeUrlFactory {
  const { clientId, redirectUri, scopes, authorizeUrl: inputAuthorizeUrl, audience } = config;
  const authorizeUrl = inputAuthorizeUrl ?? TRELLO_OAUTH_AUTHORIZE_URL;
  const scope = scopes.join(TRELLO_OAUTH_SCOPE_DELIMITER);

  return (params?: Maybe<TrelloOAuthAuthorizeUrlParams>) => {
    const url = new URL(authorizeUrl);
    const state = params?.state;

    if (audience) {
      url.searchParams.set('audience', audience);
    }

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', scope);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', TRELLO_OAUTH_AUTHORIZE_RESPONSE_TYPE);
    url.searchParams.set('prompt', TRELLO_OAUTH_AUTHORIZE_PROMPT);

    if (state != null) {
      url.searchParams.set('state', state);
    }

    if (params?.codeChallenge != null) {
      url.searchParams.set('code_challenge', params.codeChallenge);
      url.searchParams.set('code_challenge_method', TRELLO_OAUTH_AUTHORIZE_CODE_CHALLENGE_METHOD);
    }

    return url.toString();
  };
}
