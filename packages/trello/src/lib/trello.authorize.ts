import { type Maybe } from '@dereekb/util';
import { type TrelloApiKey } from './trello.type';

/**
 * Trello's classic token authorization page. Opened with an API key, it asks the signed-in member to allow the app and
 * then shows the member's API token, for the key + token mode.
 */
export const TRELLO_API_TOKEN_AUTHORIZE_URL = 'https://trello.com/1/authorize';

/**
 * A scope a classic API token can be granted.
 */
export type TrelloApiTokenScope = 'read' | 'write' | 'account';

/**
 * How long a classic API token lives.
 */
export type TrelloApiTokenExpiration = '1hour' | '1day' | '30days' | 'never';

/**
 * Every {@link TrelloApiTokenScope}, for validating input.
 */
export const ALL_TRELLO_API_TOKEN_SCOPES: readonly TrelloApiTokenScope[] = ['read', 'write', 'account'];

/**
 * Every {@link TrelloApiTokenExpiration}, for validating input.
 */
export const ALL_TRELLO_API_TOKEN_EXPIRATIONS: readonly TrelloApiTokenExpiration[] = ['1hour', '1day', '30days', 'never'];

/**
 * Config for {@link trelloApiTokenAuthorizeUrl}.
 */
export interface TrelloApiTokenAuthorizeUrlConfig {
  /**
   * The API key, from the Power-Up admin page (https://trello.com/power-ups/admin).
   */
  readonly apiKey: TrelloApiKey;
  /**
   * The scopes to ask for. Defaults to `['read']`.
   */
  readonly scopes?: Maybe<readonly TrelloApiTokenScope[]>;
  /**
   * How long the token lives. Defaults to `never`.
   */
  readonly expiration?: Maybe<TrelloApiTokenExpiration>;
  /**
   * The app name the authorization page shows the member.
   */
  readonly name?: Maybe<string>;
}

/**
 * Builds the classic `/1/authorize` url that grants a member's API token for an API key.
 *
 * With no `return_url`, Trello shows the token on the page after the member allows it, to copy by hand. A key + token
 * pair is the only credential Trello's attachment download endpoint accepts (it refuses OAuth 2.0 bearer tokens), and
 * `read` is enough for downloads.
 *
 * @param config - The API key, scopes, expiration and app name.
 * @returns The url to open in a browser signed in as the member.
 */
export function trelloApiTokenAuthorizeUrl(config: TrelloApiTokenAuthorizeUrlConfig): string {
  // built by hand so the scope list keeps its literal commas, as Trello's docs write it (URLSearchParams sends %2C)
  const params = [`key=${encodeURIComponent(config.apiKey)}`, 'response_type=token', `scope=${(config.scopes?.length ? config.scopes : ['read']).join(',')}`, `expiration=${config.expiration ?? 'never'}`, ...(config.name ? [`name=${encodeURIComponent(config.name)}`] : [])];
  return `${TRELLO_API_TOKEN_AUTHORIZE_URL}?${params.join('&')}`;
}
