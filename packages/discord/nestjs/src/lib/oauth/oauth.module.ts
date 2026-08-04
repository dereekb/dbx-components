import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscordOAuthApi } from './oauth.api';
import { DiscordOAuthServiceConfig, discordOAuthServiceConfigFactory } from './oauth.config';

export type DiscordOAuthServiceConfigFactory = (configService: ConfigService) => DiscordOAuthServiceConfig;

// MARK: App Discord OAuth Module
export interface ProvideAppDiscordOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional override for the DiscordOAuthServiceConfigFactory.
   *
   * @default discordOAuthServiceConfigFactory
   */
  readonly discordOAuthServiceConfigFactory?: DiscordOAuthServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's DiscordOAuthModule.
 *
 * Takes no `dependencyModule`, unlike the Cal.com equivalent: {@link DiscordOAuthApi} depends only on
 * its own config, since Discord's connect flow needs no access-token cache service.
 *
 * @param config - The module metadata configuration including an optional config factory.
 * @returns NestJS ModuleMetadata for registering the DiscordOAuthModule.
 */
export function appDiscordOAuthModuleMetadata(config: ProvideAppDiscordOAuthMetadataConfig): ModuleMetadata {
  const { imports, exports, providers } = config;

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    exports: [DiscordOAuthApi, ...(exports ?? [])],
    providers: [
      {
        provide: DiscordOAuthServiceConfig,
        inject: [ConfigService],
        useFactory: config.discordOAuthServiceConfigFactory ?? discordOAuthServiceConfigFactory
      },
      DiscordOAuthApi,
      ...(providers ?? [])
    ]
  };
}
