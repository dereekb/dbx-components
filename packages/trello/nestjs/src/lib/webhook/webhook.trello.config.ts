import { type TrelloAppSecret } from '@dereekb/trello';

export const TRELLO_APP_SECRET_ENV_VAR = 'TRELLO_APP_SECRET';
export const TRELLO_WEBHOOK_CALLBACK_URL_ENV_VAR = 'TRELLO_WEBHOOK_CALLBACK_URL';

export interface TrelloWebhookConfig {
  /**
   * The Trello app secret used to verify webhook signatures.
   */
  readonly appSecret: TrelloAppSecret;
  /**
   * The exact callback URL configured for the registered webhook.
   *
   * Must match the URL Trello was given on registration — the HMAC is computed over `rawBody + callbackUrl`.
   */
  readonly callbackUrl: string;
}

/**
 * Configuration for {@link TrelloWebhookService}.
 */
export abstract class TrelloWebhookServiceConfig {
  readonly webhookConfig!: TrelloWebhookConfig;

  static assertValidConfig(config: TrelloWebhookServiceConfig) {
    if (!config.webhookConfig.appSecret) {
      throw new Error('No Trello app secret specified.');
    }

    if (!config.webhookConfig.callbackUrl) {
      throw new Error('No Trello webhook callback URL specified.');
    }
  }
}
