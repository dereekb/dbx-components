import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrelloWebhookController } from './webhook.trello.controller';
import { TRELLO_APP_SECRET_ENV_VAR, TRELLO_WEBHOOK_CALLBACK_URL_ENV_VAR, TrelloWebhookServiceConfig } from './webhook.trello.config';
import { TrelloWebhookService } from './webhook.trello.service';

/**
 * Factory function that creates TrelloWebhookServiceConfig from NestJS ConfigService.
 *
 * Reads `TRELLO_APP_SECRET` and `TRELLO_WEBHOOK_CALLBACK_URL` from the environment.
 *
 * @param configService - The NestJS ConfigService.
 * @returns A validated TrelloWebhookServiceConfig.
 */
export function trelloWebhookServiceConfigFactory(configService: ConfigService): TrelloWebhookServiceConfig {
  const config: TrelloWebhookServiceConfig = {
    webhookConfig: {
      appSecret: configService.get<string>(TRELLO_APP_SECRET_ENV_VAR) as string,
      callbackUrl: configService.get<string>(TRELLO_WEBHOOK_CALLBACK_URL_ENV_VAR) as string
    }
  };

  TrelloWebhookServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  controllers: [TrelloWebhookController],
  exports: [TrelloWebhookService],
  providers: [
    {
      provide: TrelloWebhookServiceConfig,
      inject: [ConfigService],
      useFactory: trelloWebhookServiceConfigFactory
    },
    TrelloWebhookService
  ]
})
export class TrelloWebhookModule {}
