import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VapiAiApi } from './vapiai.api';
import { VAPI_AI_SECRET_TOKEN_ENV_VAR, VapiAiServiceConfig } from './vapiai.config';
import { type VapiAiSecretToken } from './vapiai.type';

/**
 * Factory that creates a VapiAiServiceConfig from environment variables.
 *
 * Reads the Vapi AI secret token from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables
 * @returns a validated VapiAiServiceConfig
 */
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

/**
 * NestJS module that provides the VapiAiApi service.
 *
 * Reads the Vapi AI secret token from environment variables for API authentication.
 */
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
