import { TypeformWebhookController } from './webhook.typeform.controller';
import { Module } from '@nestjs/common';
import { TypeformWebhookService } from './webhook.typeform.service';
import { TYPEFORM_WEBHOOK_SECRET_TOKEN_ENV_VAR, TypeformWebhookServiceConfig } from './webhook.typeform.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type TypeformWebhookSecretToken } from '../typeform.type';

/**
 * Factory that creates a TypeformWebhookServiceConfig from environment variables.
 *
 * Reads the Typeform webhook secret token from environment variables for signature verification.
 *
 * @param configService - NestJS config service for reading environment variables
 * @returns a validated TypeformWebhookServiceConfig
 */
export function typeFormWebhookServiceConfigFactory(configService: ConfigService): TypeformWebhookServiceConfig {
  const config: TypeformWebhookServiceConfig = {
    typeformWebhook: {
      secretToken: configService.get<TypeformWebhookSecretToken>(TYPEFORM_WEBHOOK_SECRET_TOKEN_ENV_VAR) as TypeformWebhookSecretToken
    }
  };

  TypeformWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that handles incoming Typeform webhook events.
 *
 * Provides the TypeformWebhookService and controller for verifying and processing Typeform webhook payloads.
 */
@Module({
  imports: [ConfigModule],
  controllers: [TypeformWebhookController],
  providers: [
    {
      provide: TypeformWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: typeFormWebhookServiceConfigFactory
    },
    TypeformWebhookService
  ],
  exports: [TypeformWebhookService]
})
export class TypeformWebhookModule {}
