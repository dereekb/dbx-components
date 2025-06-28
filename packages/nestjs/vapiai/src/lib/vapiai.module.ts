import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VapiAiApi } from './vapiai.api';
import { VAPI_AI_SECRET_TOKEN_ENV_VAR, VapiAiServiceConfig } from './vapiai.config';
import { VapiAiSecretToken } from './vapiai.type';

export function vapiaiServiceConfigFactory(configService: ConfigService): VapiAiServiceConfig {
  const config: VapiAiServiceConfig = {
    vapiai: {
      config: {
        token: configService.get<VapiAiSecretToken>(VAPI_AI_SECRET_TOKEN_ENV_VAR) as VapiAiSecretToken
      }
    }
  };

  VapiAiServiceConfig.assertValidConfig(config);
  return config;
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: VapiAiServiceConfig,
      inject: [ConfigService],
      useFactory: vapiaiServiceConfigFactory
    },
    VapiAiApi
  ],
  exports: [VapiAiApi]
})
export class VapiAiModule {}
