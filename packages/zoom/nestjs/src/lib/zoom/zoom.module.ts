import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ZoomApi } from './zoom.api';
import { ZoomServiceConfig } from './zoom.config';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
/**
 * Default factory function for creating ZoomServiceConfig from ConfigService.
 *
 * @param _configService The NestJS ConfigService (unused currently)
 * @returns A validated ZoomServiceConfig
 */
export function zoomServiceConfigFactory(_configService: ConfigService): ZoomServiceConfig {
  const config: ZoomServiceConfig = {
    zoom: {}
  };

  ZoomServiceConfig.assertValidConfig(config);
  return config;
}

// MARK: App Zoom Module
export interface ProvideAppZoomMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The ZoomModule requires the following dependencies in order to initialze properly:
   * - ZoomOAuthApi
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's ZoomModule.
 *
 * @param config The configuration for the module metadata
 * @returns Module metadata for the Zoom module
 */
export function appZoomModuleMetadata(config: ProvideAppZoomMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [ZoomApi, ...(exports ?? [])],
    providers: [
      {
        provide: ZoomServiceConfig,
        inject: [ConfigService],
        useFactory: zoomServiceConfigFactory
      },
      ZoomApi,
      ...(providers ?? [])
    ]
  };
}
