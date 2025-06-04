import { ZoomSecretToken } from '@dereekb/zoom';

export const ZOOM_SECRET_TOKEN_ENV_VAR = 'ZOOM_SECRET_TOKEN';

export interface ZoomWebhookConfig {
  readonly zoomSecretToken: ZoomSecretToken;
}

/**
 * Configuration for ZoomService
 */
export abstract class ZoomWebhookServiceConfig {
  readonly webhookConfig!: ZoomWebhookConfig;

  static assertValidConfig(config: ZoomWebhookServiceConfig) {
    if (!config.webhookConfig.zoomSecretToken) {
      throw new Error('No zoom secret token specified.');
    }
  }
}
