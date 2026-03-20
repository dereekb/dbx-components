import { VapiAiWebhookController } from './webhook.vapiai.controller';
import { Module } from '@nestjs/common';
import { VapiAiWebhookService } from './webhook.vapiai.service';
import { VAPI_AI_WEBHOOK_HMAC_SECRET_TOKEN_ENV_VAR, VAPI_AI_WEBHOOK_SECRET_TOKEN_ENV_VAR, VAPI_AI_WEBHOOK_SECRET_VERIFICATION_TYPE_ENV_VAR, VAPI_AI_WEBHOOK_SIGNATURE_PREFIX_ENV_VAR, VapiAiWebhookServiceConfig } from './webhook.vapi.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type VapiAiSecretToken, type VapiApiWebhookEventVerificationType } from '../vapiai.type';

/**
 * Factory that creates a VapiAiWebhookServiceConfig from environment variables.
 *
 * Reads the webhook secret, HMAC secret, verification type, and signature prefix from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables
 * @returns a validated VapiAiWebhookServiceConfig
 */
export function vapiaiWebhookServiceConfigFactory(configService: ConfigService): VapiAiWebhookServiceConfig {
  const config: VapiAiWebhookServiceConfig = {
    webhookConfig: {
      secret: configService.get<VapiAiSecretToken | undefined>(VAPI_AI_WEBHOOK_SECRET_TOKEN_ENV_VAR),
      hmacSecret: configService.get<VapiAiSecretToken | undefined>(VAPI_AI_WEBHOOK_HMAC_SECRET_TOKEN_ENV_VAR),
      verificationType: configService.get<VapiApiWebhookEventVerificationType | undefined>(VAPI_AI_WEBHOOK_SECRET_VERIFICATION_TYPE_ENV_VAR),
      signaturePrefix: configService.get<string | undefined>(VAPI_AI_WEBHOOK_SIGNATURE_PREFIX_ENV_VAR)
    }
  };

  VapiAiWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that handles incoming Vapi AI webhook events.
 *
 * Provides the VapiAiWebhookService and controller for verifying and processing Vapi AI webhook payloads.
 */
@Module({
  imports: [ConfigModule],
  controllers: [VapiAiWebhookController],
  providers: [
    {
      provide: VapiAiWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: vapiaiWebhookServiceConfigFactory
    },
    VapiAiWebhookService
  ],
  exports: [VapiAiWebhookService]
})
export class VapiAiWebhookModule {}
