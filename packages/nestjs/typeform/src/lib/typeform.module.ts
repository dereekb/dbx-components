import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeformApi } from './typeform.api';
import { TYPEFORM_SECRET_TOKEN_ENV_VAR, TYPEFORM_BASE_URL_ENV_VAR, TypeformServiceConfig } from './typeform.config';
import { TypeformApiToken } from './typeform.type';

export function typeFormServiceConfigFactory(configService: ConfigService): TypeformServiceConfig {
  const config: TypeformServiceConfig = {
    typeform: {
      config: {
        token: configService.get<TypeformApiToken>(TYPEFORM_SECRET_TOKEN_ENV_VAR) as TypeformApiToken,
        baseURL: configService.get<string | undefined>(TYPEFORM_BASE_URL_ENV_VAR) ?? undefined
      }
    }
  };

  TypeformServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: TypeformServiceConfig,
      inject: [ConfigService],
      useFactory: typeFormServiceConfigFactory
    },
    TypeformApi
  ],
  exports: [TypeformApi]
})
export class TypeformModule {}
