import { VapiAiWebhookController } from './webhook.vapiai.controller';
import { Module } from '@nestjs/common';
import { VapiAiWebhookService } from './webhook.vapiai.service';
import { VAPI_AI_WEBHOOK_HMAC_SECRET_TOKEN_ENV_VAR, VAPI_AI_WEBHOOK_SECRET_TOKEN_ENV_VAR, VAPI_AI_WEBHOOK_SECRET_VERIFICATION_TYPE_ENV_VAR, VAPI_AI_WEBHOOK_SIGNATURE_PREFIX_ENV_VAR, VapiAiWebhookServiceConfig } from './webhook.vapi.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VapiAiSecretToken, VapiApiWebhookEventVerificationType } from '../vapiai.type';

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
