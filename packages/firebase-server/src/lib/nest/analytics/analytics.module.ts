import { type ModuleMetadata } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { FirebaseServerAnalyticsService } from './analytics.service';
import { ON_CALL_MODEL_ANALYTICS_SERVICE } from '../model';

// MARK: App Analytics Module
/**
 * Configuration for {@link appAnalyticsModuleMetadata}.
 */
export interface ProvideAppAnalyticsMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Optional dependency module that provides a {@link FirebaseServerAnalyticsServiceListener} implementation.
   *
   * If omitted, the {@link FirebaseServerAnalyticsService} falls back to a no-op listener.
   *
   * @example
   * ```ts
   * appAnalyticsModuleMetadata({
   *   dependencyModule: FirebaseServerAnalyticsSegmentModule
   * })
   * ```
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports'][0]>;
}

/**
 * Generates NestJS {@link ModuleMetadata} for an app's analytics module.
 *
 * Provides {@link FirebaseServerAnalyticsService} and registers it as the
 * {@link ON_CALL_MODEL_ANALYTICS_SERVICE} token for the onCall dispatch chain.
 *
 * @param config - the configuration including an optional dependency module and additional providers
 * @returns module metadata ready for use with `@Module()`
 *
 * @example
 * ```ts
 * @Module(appAnalyticsModuleMetadata({
 *   dependencyModule: FirebaseServerAnalyticsSegmentModule
 * }))
 * export class AppAnalyticsModule {}
 * ```
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
