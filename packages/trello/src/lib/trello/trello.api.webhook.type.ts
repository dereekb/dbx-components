import { type Maybe } from '@dereekb/util';
import { type TrelloId, type TrelloWebhookId } from '../trello.type';

/**
 * Trello webhook registration.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
 */
export interface TrelloWebhook {
  readonly id: TrelloWebhookId;
  readonly idModel: TrelloId;
  readonly callbackURL: string;
  readonly description: string;
  readonly active: boolean;
  readonly consecutiveFailures?: number;
  readonly firstConsecutiveFailDate?: Maybe<string>;
}

export interface CreateWebhookBody {
  /**
   * The id of the model (board, card, member, list, etc.) to subscribe to.
   */
  readonly idModel: TrelloId;
  /**
   * The URL Trello will POST to when an event occurs.
   *
   * Trello validates this URL with a HEAD request before creation. It must respond with 200.
   */
  readonly callbackURL: string;
  /**
   * Optional human-readable description.
   */
  readonly description?: string;
  /**
   * Whether the webhook is active. Defaults to true.
   */
  readonly active?: boolean;
}

export interface UpdateWebhookBody {
  readonly callbackURL?: string;
  readonly description?: string;
  readonly active?: boolean;
}
