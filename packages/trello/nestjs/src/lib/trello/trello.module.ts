import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrelloApi } from './trello.api';
import { TRELLO_API_KEY_ENV_VAR, TRELLO_API_TOKEN_ENV_VAR, TrelloServiceConfig } from './trello.config';

/**
 * Default factory function for creating TrelloServiceConfig from ConfigService.
 *
 * Reads `TRELLO_API_KEY` and `TRELLO_API_TOKEN` from the environment.
 *
 * @param configService - The NestJS ConfigService.
 * @returns A validated TrelloServiceConfig.
 */
export function trelloServiceConfigFactory(configService: ConfigService): TrelloServiceConfig {
  const config: TrelloServiceConfig = {
    trello: {
      apiKey: configService.get<string>(TRELLO_API_KEY_ENV_VAR) as string,
      apiToken: configService.get<string>(TRELLO_API_TOKEN_ENV_VAR) as string
    }
  };

  TrelloServiceConfig.assertValidConfig(config);
  return config;
}

export interface ProvideAppTrelloMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {}

/**
 * Convenience function used to generate ModuleMetadata for an app's TrelloModule.
 *
 * @param config - Optional additional module metadata overrides.
 * @returns Module metadata for the Trello module.
 */
export function appTrelloModuleMetadata(config?: ProvideAppTrelloMetadataConfig): ModuleMetadata {
  const { imports, exports, providers } = config ?? {};

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    exports: [TrelloApi, ...(exports ?? [])],
    providers: [
      {
        provide: TrelloServiceConfig,
        inject: [ConfigService],
        useFactory: trelloServiceConfigFactory
      },
      TrelloApi,
      ...(providers ?? [])
    ]
  };
}
