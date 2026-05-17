import { type TrelloApiKey, type TrelloApiToken, type TrelloApiUrl } from './trello.type';

/**
 * Configuration for a TrelloContext.
 */
export interface TrelloConfig {
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
  /**
   * Optional custom API base URL. Defaults to https://api.trello.com/1.
   */
  readonly apiUrl?: TrelloApiUrl | string;
}
