import { VapiApiWebhookEventVerificationConfig } from './webhook.vapiai.verify';

export const VAPI_AI_WEBHOOK_SECRET_TOKEN_ENV_VAR = 'VAPI_AI_WEBHOOK_SECRET_TOKEN';
export const VAPI_AI_WEBHOOK_HMAC_SECRET_TOKEN_ENV_VAR = 'VAPI_AI_WEBHOOK_HMAC_SECRET_TOKEN';
export const VAPI_AI_WEBHOOK_SECRET_VERIFICATION_TYPE_ENV_VAR = 'VAPI_AI_WEBHOOK_SECRET_VERIFICATION_TYPE';
export const VAPI_AI_WEBHOOK_SIGNATURE_PREFIX_ENV_VAR = 'VAPI_AI_WEBHOOK_SIGNATURE_PREFIX';

export interface VapiAiWebhookConfig extends VapiApiWebhookEventVerificationConfig {}

/**
 * Configuration for VapiAiService
 */
export abstract class VapiAiWebhookServiceConfig {
  readonly webhookConfig!: VapiAiWebhookConfig;

  static assertValidConfig(config: VapiAiWebhookServiceConfig) {
    if (!config.webhookConfig.secret && !config.webhookConfig.hmacSecret) {
      throw new Error('No Vapi.ai webhook secret token specified.');
    }
  }
}
