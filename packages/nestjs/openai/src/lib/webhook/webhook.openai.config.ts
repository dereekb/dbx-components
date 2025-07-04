import { OpenAIWebhookSecret } from '../openai.type';

export const OPENAI_WEBHOOK_SECRET_ENV_VAR = 'OPENAI_WEBHOOK_SECRET';

export interface OpenAIWebhookConfig {
  readonly webhookSecret: OpenAIWebhookSecret;
}

/**
 * Configuration for OpenAIService
 */
export abstract class OpenAIWebhookServiceConfig {
  readonly openaiWebhook!: OpenAIWebhookConfig;

  static assertValidConfig(config: OpenAIWebhookServiceConfig) {
    if (!config.openaiWebhook.webhookSecret) {
      throw new Error('No OpenAI webhook secret specified.');
    }
  }
}
