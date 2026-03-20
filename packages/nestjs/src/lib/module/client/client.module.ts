import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CLIENT_WEB_APP_URL_ENV_VAR } from './client';
import { ClientAppServiceConfig } from './client.config';
import { ClientAppService } from './client.service';

/**
 * Factory that creates a ClientAppServiceConfig from environment variables.
 *
 * Reads the client web app URL from the CLIENT_WEB_APP_URL environment variable.
 *
 * @param configService - NestJS config service for reading environment variables
 * @returns a validated ClientAppServiceConfig
 */
export function clientAppConfigFactory(configService: ConfigService): ClientAppServiceConfig {
  const config: ClientAppServiceConfig = {
    client: {
      clientWebAppUrl: configService.get<string>(CLIENT_WEB_APP_URL_ENV_VAR) as string
    }
  };

  ClientAppServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides the ClientAppService for accessing client application configuration.
 *
 * Reads the client web app URL from environment variables and makes it available via ClientAppService.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ClientAppServiceConfig,
      inject: [ConfigService],
      useFactory: clientAppConfigFactory
    },
    ClientAppService
  ],
  exports: [ClientAppService]
})
export class ClientAppModule {}
