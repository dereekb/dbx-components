import { OpenRouterWebhookController } from './webhook.openrouter.controller';
import { Module } from '@nestjs/common';
import { OpenRouterWebhookService } from './webhook.openrouter.service';
import { OPENROUTER_WEBHOOK_HEADER_ENV_VAR, OPENROUTER_WEBHOOK_SCHEME_ENV_VAR, OPENROUTER_WEBHOOK_SECRET_TOKEN_ENV_VAR, OpenRouterWebhookServiceConfig } from './webhook.openrouter.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterWebhookSecret } from '../openrouter.type';

/**
 * Factory that creates an OpenRouterWebhookServiceConfig from environment variables.
 *
 * Reads the OpenRouter webhook secret token, and the optional header name and scheme, from
 * environment variables.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A validated OpenRouterWebhookServiceConfig.
 */
export function openRouterWebhookServiceConfigFactory(configService: ConfigService): OpenRouterWebhookServiceConfig {
  const config: OpenRouterWebhookServiceConfig = {
    openrouterWebhook: {
      webhookSecret: configService.get<OpenRouterWebhookSecret>(OPENROUTER_WEBHOOK_SECRET_TOKEN_ENV_VAR) as OpenRouterWebhookSecret,
      header: configService.get<Maybe<string>>(OPENROUTER_WEBHOOK_HEADER_ENV_VAR) ?? undefined,
      scheme: configService.get<Maybe<string>>(OPENROUTER_WEBHOOK_SCHEME_ENV_VAR) ?? undefined
    }
  };

  OpenRouterWebhookServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that handles incoming OpenRouter broadcast webhook events.
 *
 * Standalone — does not depend on OpenRouterModule (no API key needed). Verification is a
 * constant-time comparison of the user-configured secret header, so the SDK client is unused here.
 * Provides the OpenRouterWebhookService and controller for verifying and processing broadcast payloads.
 */
@Module({
  imports: [ConfigModule],
  controllers: [OpenRouterWebhookController],
  providers: [
    {
      provide: OpenRouterWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: openRouterWebhookServiceConfigFactory
    },
    OpenRouterWebhookService
  ],
  exports: [OpenRouterWebhookService]
})
export class OpenRouterWebhookModule {}
