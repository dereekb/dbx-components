import { type TypeformWebhookSecretToken } from '../typeform.type';

export const TYPEFORM_WEBHOOK_SECRET_TOKEN_ENV_VAR = 'TYPEFORM_WEBHOOK_SECRET_TOKEN';

export interface TypeformWebhookConfig {
  readonly secretToken: TypeformWebhookSecretToken;
}

/**
 * Configuration for TypeformService
 */
export abstract class TypeformWebhookServiceConfig {
  readonly typeformWebhook!: TypeformWebhookConfig;

  static assertValidConfig(config: TypeformWebhookServiceConfig) {
    if (!config.typeformWebhook.secretToken) {
      throw new Error('No Typeform webhook secret specified.');
    }
  }
}
