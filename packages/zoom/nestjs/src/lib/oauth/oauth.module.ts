import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { readZoomOAuthServiceConfigFromConfigService, ZoomOAuthServiceConfig } from './oauth.config';
import { ZoomOAuthApi } from './oauth.api';
import { type Maybe } from '@dereekb/util';

export type ZoomOAuthServiceConfigFactory = (configService: ConfigService) => ZoomOAuthServiceConfig;

/**
 * Default factory function for creating ZoomOAuthServiceConfig from ConfigService.
 *
 * @param configService The NestJS ConfigService
 * @returns A validated ZoomOAuthServiceConfig
 */
export function zoomOAuthServiceConfigFactory(configService: ConfigService): ZoomOAuthServiceConfig {
  return readZoomOAuthServiceConfigFromConfigService(configService);
}

// MARK: App Zoom OAuth Module
export interface ProvideAppZoomOAuthMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZoomOAuthModule requires the following dependencies in order to initialze properly:
   * - ZoomOAuthAccessTokenCacheService
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
  /**
   * Optional override for the ZoomOAuthServiceConfigFactory.
   *
   * @default zoomOAuthServiceConfigFactory
   */
  readonly zoomOAuthServiceConfigFactory?: ZoomOAuthServiceConfigFactory;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's ZoomOAuthModule.
 *
 * @param config The configuration for the module metadata
 * @returns Module metadata for the Zoom OAuth module
 */
export function appZoomOAuthModuleMetadata(config: ProvideAppZoomOAuthMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZoomOAuthApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZoomOAuthServiceConfig,
        inject: [ConfigService],
        useFactory: config.zoomOAuthServiceConfigFactory ?? zoomOAuthServiceConfigFactory
      },
      ZoomOAuthApi,
      ...(providers ?? [])
    ]
  };
}
