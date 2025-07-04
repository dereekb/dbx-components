import { OpenAIWebhookController } from './webhook.openai.controller';
import { Module } from '@nestjs/common';
import { OpenAIWebhookService } from './webhook.openai.service';
import { OPENAI_WEBHOOK_SECRET_ENV_VAR, OpenAIWebhookServiceConfig } from './webhook.openai.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenAIWebhookSecret } from '../openai.type';
import { OpenAIModule } from '../openai.module';

export function openAIWebhookServiceConfigFactory(configService: ConfigService): OpenAIWebhookServiceConfig {
  const config: OpenAIWebhookServiceConfig = {
    openaiWebhook: {
      webhookSecret: configService.get<OpenAIWebhookSecret>(OPENAI_WEBHOOK_SECRET_ENV_VAR) as OpenAIWebhookSecret
    }
  };

  OpenAIWebhookServiceConfig.assertValidConfig(config);
  return config;
}

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
