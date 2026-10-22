import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrelloOAuthApi } from './oauth.api';
import { TrelloOAuthServiceConfig, trelloOAuthServiceConfigFactory } from './oauth.config';

export type TrelloOAuthServiceConfigFactory = (configService: ConfigService) => TrelloOAuthServiceConfig;

// MARK: App Trello OAuth Module
export interface ProvideAppTrelloOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional override for the TrelloOAuthServiceConfigFactory.
   *
   * @default trelloOAuthServiceConfigFactory
   */
  readonly trelloOAuthServiceConfigFactory?: TrelloOAuthServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's TrelloOAuthModule.
 *
 * One module is one OAuth client. Several connection instances (`trello`, `trello_bot`) can share it;
 * a second OAuth client is a second module.
 *
 * @param config - The module metadata configuration including an optional config factory.
 * @returns NestJS ModuleMetadata for registering the TrelloOAuthModule.
 */
export function appTrelloOAuthModuleMetadata(config: ProvideAppTrelloOAuthMetadataConfig = {}): ModuleMetadata {
  const { imports, exports, providers } = config;

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    exports: [TrelloOAuthApi, ...(exports ?? [])],
    providers: [
      {
        provide: TrelloOAuthServiceConfig,
        inject: [ConfigService],
        useFactory: config.trelloOAuthServiceConfigFactory ?? trelloOAuthServiceConfigFactory
      },
      TrelloOAuthApi,
      ...(providers ?? [])
    ]
  };
}
