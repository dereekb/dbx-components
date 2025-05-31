import { ZoomWebhookController } from './webhook.zoom.controller';
import { Module } from '@nestjs/common';
import { ZoomWebhookService } from './webhook.zoom.service';
import { ConfigService } from '@nestjs/config';
import { ZOOM_SECRET_TOKEN_ENV_VAR, ZoomWebhookServiceConfig } from './webhook.zoom.config';

export function zoomWebhookServiceConfigFactory(configService: ConfigService): ZoomWebhookServiceConfig {
  const config: ZoomWebhookServiceConfig = {
    webhookConfig: {
      zoomSecretToken: configService.get<string>(ZOOM_SECRET_TOKEN_ENV_VAR) as string
    }
  };

  ZoomWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * Configures webhooks for the service.
 */
@Module({
  controllers: [ZoomWebhookController],
  exports: [ZoomWebhookService],
  providers: [
    {
      provide: ZoomWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: zoomWebhookServiceConfigFactory
    },
    ZoomWebhookService
  ]
})
export class ZoomWebhookModule {}
