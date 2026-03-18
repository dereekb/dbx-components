import { type ModuleMetadata } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { FirebaseServerAnalyticsService } from './analytics.service';
import { ON_CALL_MODEL_ANALYTICS_SERVICE } from '../model';

// MARK: App Analytics Module
export interface ProvideAppAnalyticsMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the required dependencies for this module.
   * Must export {@link FirebaseServerAnalyticsServiceListener}.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports'][0]>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's analytics module.
 *
 * This generated module requires the following dependencies in order to initialize properly:
 * - {@link FirebaseServerAnalyticsServiceListener}
 *
 * By default this module exports:
 * - {@link FirebaseServerAnalyticsService}
 * - {@link ON_CALL_MODEL_ANALYTICS_SERVICE}
 *
 * @param config
 * @returns
 */
export function appAnalyticsModuleMetadata(config: ProvideAppAnalyticsMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [...dependencyModuleImport, ...(imports ?? [])],
    exports: [FirebaseServerAnalyticsService, ON_CALL_MODEL_ANALYTICS_SERVICE, ...(exports ?? [])],
    providers: [
      FirebaseServerAnalyticsService,
      {
        provide: ON_CALL_MODEL_ANALYTICS_SERVICE,
        useExisting: FirebaseServerAnalyticsService
      },
      ...(providers ?? [])
    ]
  };
}
