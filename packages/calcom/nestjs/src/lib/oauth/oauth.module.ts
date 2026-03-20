import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { calcomOAuthServiceConfigFactory, CalcomOAuthServiceConfig } from './oauth.config';
import { CalcomOAuthApi } from './oauth.api';
import { type Maybe } from '@dereekb/util';

export type CalcomOAuthServiceConfigFactory = (configService: ConfigService) => CalcomOAuthServiceConfig;

// MARK: App Calcom OAuth Module
export interface ProvideAppCalcomOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The CalcomOAuthModule requires the following dependencies in order to initialize properly:
   * - CalcomOAuthAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those dependencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * Optional override for the CalcomOAuthServiceConfigFactory.
   *
   * @default calcomOAuthServiceConfigFactory
   */
  readonly calcomOAuthServiceConfigFactory?: CalcomOAuthServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's CalcomOAuthModule.
 *
 * @param config - the module metadata configuration including optional dependency module and config factory
 * @returns NestJS ModuleMetadata for registering the CalcomOAuthModule
 */
export function appCalcomOAuthModuleMetadata(config: ProvideAppCalcomOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [CalcomOAuthApi, ...(exports ?? [])],
    providers: [
      {
        provide: CalcomOAuthServiceConfig,
        inject: [ConfigService],
        useFactory: config.calcomOAuthServiceConfigFactory ?? calcomOAuthServiceConfigFactory
      },
      CalcomOAuthApi,
      ...(providers ?? [])
    ]
  };
}
