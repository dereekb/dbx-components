export const CALCOM_WEBHOOK_SECRET_CONFIG_KEY = 'CALCOM_WEBHOOK_SECRET';

export interface CalcomWebhookConfig {
  readonly webhookSecret: string;
}

/**
 * Configuration for CalcomWebhookService
 */
export abstract class CalcomWebhookServiceConfig {
  readonly webhookConfig!: CalcomWebhookConfig;

  static assertValidConfig(config: CalcomWebhookServiceConfig) {
    if (!config.webhookConfig.webhookSecret) {
      throw new Error('No Cal.com webhook secret specified.');
    }
  }
}
