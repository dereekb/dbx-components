export const ZOHO_SIGN_WEBHOOK_SECRET_TOKEN_ENV_VAR = 'ZOHO_SIGN_WEBHOOK_SECRET_TOKEN';

export interface ZohoSignWebhookConfig {
  readonly webhookSecret: string;
}

/**
 * Configuration for the Zoho Sign webhook service.
 */
export abstract class ZohoSignWebhookServiceConfig {
  readonly zohoSignWebhook!: ZohoSignWebhookConfig;

  static assertValidConfig(config: ZohoSignWebhookServiceConfig) {
    if (!config.zohoSignWebhook.webhookSecret) {
      throw new Error('No Zoho Sign webhook secret specified.');
    }
  }
}
