import { OpenAIWebhookController } from './webhook.openai.controller';
import { Module } from '@nestjs/common';
import { OpenAIWebhookService } from './webhook.openai.service';
import { OPENAI_WEBHOOK_SECRET_TOKEN_ENV_VAR, OpenAIWebhookServiceConfig } from './webhook.openai.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type OpenAIWebhookSecret } from '../openai.type';
import { OpenAIModule } from '../openai.module';

/**
 * Factory that creates an OpenAIWebhookServiceConfig from environment variables.
 *
 * Reads the OpenAI webhook secret token from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables
 * @returns a validated OpenAIWebhookServiceConfig
 */
export function openAIWebhookServiceConfigFactory(configService: ConfigService): OpenAIWebhookServiceConfig {
  const config: OpenAIWebhookServiceConfig = {
    openaiWebhook: {
      webhookSecret: configService.get<OpenAIWebhookSecret>(OPENAI_WEBHOOK_SECRET_TOKEN_ENV_VAR) as OpenAIWebhookSecret
    }
  };

  OpenAIWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that handles incoming OpenAI webhook events.
 *
 * Provides the OpenAIWebhookService and controller for verifying and processing webhook payloads.
 */
@Module({
  imports: [ConfigModule, OpenAIModule],
  controllers: [OpenAIWebhookController],
  providers: [
    {
      provide: OpenAIWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: openAIWebhookServiceConfigFactory
    },
    OpenAIWebhookService
  ],
  exports: [OpenAIWebhookService]
})
export class OpenAIWebhookModule {}
