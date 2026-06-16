import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenRouterApi } from './openrouter.api';
import { OPENROUTER_API_KEY_ENV_VAR, OPENROUTER_SERVER_URL_ENV_VAR, OpenRouterServiceConfig } from './openrouter.config';
import { type OpenRouterApiKey, type OpenRouterServerUrl } from './openrouter.type';

/**
 * Factory that creates an OpenRouterServiceConfig from environment variables.
 *
 * Reads the API key and optional server/base URL override from environment variables.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A validated OpenRouterServiceConfig.
 */
export function openRouterServiceConfigFactory(configService: ConfigService): OpenRouterServiceConfig {
  const config: OpenRouterServiceConfig = {
    openrouter: {
      apiKey: configService.get<OpenRouterApiKey>(OPENROUTER_API_KEY_ENV_VAR) as OpenRouterApiKey,
      serverURL: configService.get<OpenRouterServerUrl | undefined>(OPENROUTER_SERVER_URL_ENV_VAR) ?? undefined
    }
  };

  OpenRouterServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides the OpenRouterApi service.
 *
 * Reads the OpenRouter API key and optional server URL override from environment variables.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OpenRouterServiceConfig,
      inject: [ConfigService],
      useFactory: openRouterServiceConfigFactory
    },
    OpenRouterApi
  ],
  exports: [OpenRouterApi]
})
export class OpenRouterModule {}
