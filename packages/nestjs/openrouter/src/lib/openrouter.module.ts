import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenRouterApi } from './openrouter.api';
import { OPENROUTER_API_KEY_ENV_VAR, OPENROUTER_BASE_URL_ENV_VAR, OPENROUTER_SERVER_URL_ENV_VAR, OpenRouterServiceConfig } from './openrouter.config';
import { type OpenRouterApiKey, type OpenRouterServerUrl } from './openrouter.type';

/**
 * Factory that creates an OpenRouterServiceConfig from environment variables.
 *
 * Reads the API key from `OPENROUTER_API_KEY`, and the optional server/base URL override from `OPENROUTER_SERVER_URL`,
 * then `OPENROUTER_BASE_URL`.
 *
 * `timeoutMs` and `retryConfig` are not read from the environment; set them through a custom `OpenRouterServiceConfig`
 * provider.
 *
 * @param configService - NestJS config service for reading environment variables.
 * @returns A validated OpenRouterServiceConfig.
 */
export function openRouterServiceConfigFactory(configService: ConfigService): OpenRouterServiceConfig {
  const config: OpenRouterServiceConfig = {
    openrouter: {
      apiKey: configService.get<OpenRouterApiKey>(OPENROUTER_API_KEY_ENV_VAR) as OpenRouterApiKey,
      serverURL: configService.get<OpenRouterServerUrl | undefined>(OPENROUTER_SERVER_URL_ENV_VAR) ?? configService.get<OpenRouterServerUrl | undefined>(OPENROUTER_BASE_URL_ENV_VAR) ?? undefined
    }
  };

  OpenRouterServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides the OpenRouterApi service.
 *
 * Reads the OpenRouter API key from `OPENROUTER_API_KEY`, and the optional server URL override from
 * `OPENROUTER_SERVER_URL`, then `OPENROUTER_BASE_URL`. `timeoutMs` and `retryConfig` are not read from the environment;
 * set them through a custom `OpenRouterServiceConfig` provider.
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
