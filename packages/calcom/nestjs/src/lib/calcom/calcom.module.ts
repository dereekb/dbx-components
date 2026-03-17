import { type ModuleMetadata } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CalcomApi } from './calcom.api';
import { CalcomServiceConfig } from './calcom.config';
import { type Maybe } from '@dereekb/util';

// MARK: Provider Factories
export function calcomServiceConfigFactory(_configService: ConfigService): CalcomServiceConfig {
  const config: CalcomServiceConfig = {
    calcom: {}
  };

  CalcomServiceConfig.assertValidConfig(config);
  return config;
}

// MARK: App Calcom Module
export interface ProvideAppCalcomMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The CalcomModule requires the following dependencies in order to initialize properly:
   * - CalcomOAuthApi
   *
   * This module declaration makes it easier to import a module that exports those dependencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's CalcomModule.
 */
export function appCalcomModuleMetadata(config: ProvideAppCalcomMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [CalcomApi, ...(exports ?? [])],
    providers: [
      {
        provide: CalcomServiceConfig,
        inject: [ConfigService],
        useFactory: calcomServiceConfigFactory
      },
      CalcomApi,
      ...(providers ?? [])
    ]
  };
}
