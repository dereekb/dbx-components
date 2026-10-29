import { MS_IN_DAY, type Milliseconds } from '@dereekb/util';
import { type ConfiguredFetch, type FetchJsonFunction } from '@dereekb/util/fetch';

/**
 * The Atlassian authorize URL a user's browser is redirected to for Trello's OAuth 2.0 (3LO) consent.
 *
 * Trello's OAuth 2.0 runs on Atlassian's authorization server, not on `trello.com`.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/oauth-2-confidential-client-usage/
 */
export const TRELLO_OAUTH_AUTHORIZE_URL = 'https://auth.atlassian.com/authorize';

/**
 * The Atlassian token endpoint for Trello's OAuth 2.0.
 *
 * Trello's confidential-client guide names this URL in its "Token endpoint URL" bullet and in both code
 * samples, while one paragraph of prose says `/authorize/oauth/token`; Atlassian's own 3LO uses
 * `/oauth/token`. Unverified against the live server (`tools/scripts/trello-oauth2-spike.mjs` checks
 * it), so it is kept in this one constant.
 *
 * The body is JSON, unlike Discord's form-encoded token endpoint.
 */
export const TRELLO_OAUTH_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';

/**
 * How long a Trello OAuth 2.0 refresh token lives: 90 days.
 */
export const TRELLO_OAUTH_REFRESH_TOKEN_LIFETIME: Milliseconds = MS_IN_DAY * 90;

/**
 * Whether a refresh token's 90-day lifetime is counted from the original consent (`absolute`) or from
 * the latest refresh (`sliding`).
 */
export type TrelloOAuthRefreshTokenExpirationMode = 'sliding' | 'absolute';

/**
 * How {@link TRELLO_OAUTH_REFRESH_TOKEN_LIFETIME} is counted.
 *
 * Trello says only that refresh tokens "expire after 90 days"; Atlassian's rotating refresh tokens
 * describe a 90-day INACTIVITY expiry that each new rotating refresh token resets. Defaults to
 * `sliding` on that basis — unverified against the live server, so kept in this one constant.
 */
export const TRELLO_OAUTH_REFRESH_TOKEN_EXPIRATION_MODE: TrelloOAuthRefreshTokenExpirationMode = 'sliding';

/**
 * A Trello OAuth 2.0 client id, issued at `https://trello.com/apps/admin` on the "OAuth 2.0" tab.
 */
export type TrelloOAuthClientId = string;

/**
 * A Trello OAuth 2.0 confidential-client secret.
 */
export type TrelloOAuthClientSecret = string;

/**
 * Configuration for a Trello OAuth 2.0 client.
 *
 * Both values are required: a confidential client always authenticates its token requests.
 */
export interface TrelloOAuthConfig {
  readonly clientId: TrelloOAuthClientId;
  readonly clientSecret: TrelloOAuthClientSecret;
}

/**
 * Context used for performing fetch() and fetchJson() calls with a configured fetch instance.
 *
 * Its fetch has no base URL: token calls go to {@link TRELLO_OAUTH_TOKEN_URL} on `auth.atlassian.com`,
 * while the member read goes to the Trello REST base, so every call passes a full URL.
 */
export interface TrelloOAuthContext {
  readonly fetch: ConfiguredFetch;
  readonly fetchJson: FetchJsonFunction;
  readonly config: TrelloOAuthConfig;
}

export interface TrelloOAuthContextRef {
  readonly oauthContext: TrelloOAuthContext;
}
