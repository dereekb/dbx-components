import { ZohoSignWebhookController } from './webhook.zoho.sign.controller';
import { Module } from '@nestjs/common';
import { ZohoSignWebhookService } from './webhook.zoho.sign.service';
import { ZOHO_SIGN_WEBHOOK_SECRET_TOKEN_ENV_VAR, ZohoSignWebhookServiceConfig } from './webhook.zoho.sign.config';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Reads the Zoho Sign webhook secret from the NestJS ConfigService
 * and returns a validated webhook service config.
 *
 * @param configService - NestJS config service populated with webhook environment variables
 * @returns Validated Zoho Sign webhook service configuration
 * @throws {Error} If the webhook secret is not configured
 */
export function zohoSignWebhookServiceConfigFactory(configService: ConfigService): ZohoSignWebhookServiceConfig {
  const config: ZohoSignWebhookServiceConfig = {
    zohoSignWebhook: {
      webhookSecret: configService.get<string>(ZOHO_SIGN_WEBHOOK_SECRET_TOKEN_ENV_VAR) as string
    }
  };

  ZohoSignWebhookServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  controllers: [ZohoSignWebhookController],
  providers: [
    {
      provide: ZohoSignWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: zohoSignWebhookServiceConfigFactory
    },
    ZohoSignWebhookService
  ],
  exports: [ZohoSignWebhookService]
})
export class ZohoSignWebhookModule {}
