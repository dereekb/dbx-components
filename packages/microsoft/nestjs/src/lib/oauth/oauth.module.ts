import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MicrosoftOAuthApi } from './oauth.api';
import { MicrosoftOAuthServiceConfig, microsoftOAuthServiceConfigFactory } from './oauth.config';

export type MicrosoftOAuthServiceConfigFactory = (configService: ConfigService) => MicrosoftOAuthServiceConfig;

// MARK: App Microsoft OAuth Module
export interface ProvideAppMicrosoftOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional override for the MicrosoftOAuthServiceConfigFactory.
   *
   * @default microsoftOAuthServiceConfigFactory
   */
  readonly microsoftOAuthServiceConfigFactory?: MicrosoftOAuthServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's MicrosoftOAuthModule.
 *
 * One module is one OAuth client. Several connection instances can share it;
 * a second OAuth client is a second module.
 *
 * @param config - The module metadata configuration including an optional config factory.
 * @returns NestJS ModuleMetadata for registering the MicrosoftOAuthModule.
 */
export function appMicrosoftOAuthModuleMetadata(config: ProvideAppMicrosoftOAuthMetadataConfig = {}): ModuleMetadata {
  const { imports, exports, providers } = config;

  return {
    imports: [ConfigModule, ...(imports ?? [])],
    exports: [MicrosoftOAuthApi, ...(exports ?? [])],
    providers: [
      {
        provide: MicrosoftOAuthServiceConfig,
        inject: [ConfigService],
        useFactory: config.microsoftOAuthServiceConfigFactory ?? microsoftOAuthServiceConfigFactory
      },
      MicrosoftOAuthApi,
      ...(providers ?? [])
    ]
  };
}
