import { TypeformWebhookController } from './webhook.typeform.controller';
import { Module } from '@nestjs/common';
import { TypeformWebhookService } from './webhook.typeform.service';
import { TYPEFORM_WEBHOOK_SECRET_TOKEN_ENV_VAR, TypeformWebhookServiceConfig } from './webhook.typeform.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeformWebhookSecretToken } from '../typeform.type';

export function typeFormWebhookServiceConfigFactory(configService: ConfigService): TypeformWebhookServiceConfig {
  const config: TypeformWebhookServiceConfig = {
    typeformWebhook: {
      secretToken: configService.get<TypeformWebhookSecretToken>(TYPEFORM_WEBHOOK_SECRET_TOKEN_ENV_VAR) as TypeformWebhookSecretToken
    }
  };

  TypeformWebhookServiceConfig.assertValidConfig(config);
  return config;
}

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
