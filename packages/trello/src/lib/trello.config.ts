import { type Maybe, type Milliseconds } from '@dereekb/util';
import { type TrelloApiKey, type TrelloApiToken, type TrelloOAuthAccessTokenString } from './trello.type';

/**
 * Configuration shared by every {@link TrelloConfig} mode.
 */
interface TrelloConfigBase {
  /**
   * Optional custom API base URL.
   *
   * Defaults to `TRELLO_API_URL` for the key+token mode and `TRELLO_OAUTH_API_URL` for both bearer modes.
   */
  readonly apiUrl?: string;
}

/**
 * The legacy key+token mode: an API key plus a member's API token, sent as
 * `Authorization: OAuth oauth_consumer_key=…, oauth_token=…`.
 */
export interface TrelloApiKeyTokenConfig extends TrelloConfigBase {
  /**
   * Trello API key. Created at https://trello.com/power-ups/admin.
   *
   * Note that the API key alone does not grant access to user data.
   */
  readonly apiKey: TrelloApiKey;
  /**
   * Trello user API token. Required for all authenticated requests.
   */
  readonly apiToken: TrelloApiToken;
  readonly accessToken?: never;
  readonly accessTokenProvider?: never;
}

/**
 * A static OAuth 2.0 bearer token.
 *
 * There is no refresh path: a 401 throws, as in the key+token mode.
 */
export interface TrelloAccessTokenConfig extends TrelloConfigBase {
  readonly accessToken: TrelloOAuthAccessTokenString;
  readonly apiKey?: never;
  readonly apiToken?: never;
  readonly accessTokenProvider?: never;
}

/**
 * An OAuth 2.0 bearer token supplied by a provider, cached until it nears expiry.
 *
 * On a 401 the cache is cleared, `accessTokenProvider.resetAccessToken` is awaited, and the request is
 * retried ONCE — a 401 means the request was not acted on, so a retry is safe.
 */
export interface TrelloAccessTokenProviderConfig extends TrelloConfigBase {
  readonly accessTokenProvider: TrelloAccessTokenProvider;
  /**
   * How long before its stated expiration a cached token is replaced. Defaults to one minute.
   */
  readonly accessTokenExpirationBuffer?: Maybe<Milliseconds>;
  readonly apiKey?: never;
  readonly apiToken?: never;
  readonly accessToken?: never;
}

/**
 * Configuration for a TrelloContext: the legacy key+token mode, or one of the two OAuth 2.0 bearer modes.
 *
 * The modes' members are mutually exclusive (`?: never`), so an object mixing two does not type-check.
 */
export type TrelloConfig = TrelloApiKeyTokenConfig | TrelloAccessTokenConfig | TrelloAccessTokenProviderConfig;

/**
 * An access token handed out by a {@link TrelloAccessTokenProvider}.
 */
export interface TrelloBearerAccessToken {
  readonly accessToken: TrelloOAuthAccessTokenString;
  /**
   * When the token expires. A token without one is cached until a 401 resets it.
   */
  readonly expiresAt?: Maybe<Date>;
}

/**
 * Supplies the OAuth 2.0 access token a bearer-mode Trello context sends.
 *
 * `resetAccessToken`, when present, is awaited after a 401 so the next call returns a fresh token — for
 * example by marking the stored connection as rejected so it is refreshed.
 */
export type TrelloAccessTokenProvider = (() => Promise<TrelloBearerAccessToken>) & { readonly resetAccessToken?: () => Promise<void> };

/**
 * Whether the config uses the legacy key+token mode.
 *
 * @param config - The config to check.
 * @returns True for a {@link TrelloApiKeyTokenConfig}.
 */
export function isTrelloApiKeyTokenConfig(config: TrelloConfig): config is TrelloApiKeyTokenConfig {
  return (config as TrelloApiKeyTokenConfig).apiKey != null || (config as TrelloApiKeyTokenConfig).apiToken != null;
}

/**
 * Whether the config uses a static OAuth 2.0 bearer token.
 *
 * @param config - The config to check.
 * @returns True for a {@link TrelloAccessTokenConfig}.
 */
export function isTrelloAccessTokenConfig(config: TrelloConfig): config is TrelloAccessTokenConfig {
  return (config as TrelloAccessTokenConfig).accessToken != null;
}

/**
 * Whether the config uses an OAuth 2.0 access token provider.
 *
 * @param config - The config to check.
 * @returns True for a {@link TrelloAccessTokenProviderConfig}.
 */
export function isTrelloAccessTokenProviderConfig(config: TrelloConfig): config is TrelloAccessTokenProviderConfig {
  return (config as TrelloAccessTokenProviderConfig).accessTokenProvider != null;
}
