import { type EnvironmentProviders, Injector, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxAnalyticsSegmentApiService, DbxAnalyticsSegmentApiServiceConfig, PRELOAD_SEGMENT_TOKEN } from './segment.service';

/**
 * Factory function that creates a {@link DbxAnalyticsSegmentApiServiceConfig} using the Angular injector.
 *
 * Used by {@link provideDbxAnalyticsSegmentApiService} to defer Segment configuration to runtime.
 */
export type DbxAnalyticsSegmentApiServiceConfigFactory = (injector: Injector) => DbxAnalyticsSegmentApiServiceConfig;

/**
 * Configuration for {@link provideDbxAnalyticsSegmentApiService}.
 */
export interface ProvideDbxAnalyticsSegmentModuleConfig {
  /** Whether to preload the Segment script token. */
  readonly preloadSegmentToken?: boolean;
  /** Factory function that produces the Segment API service configuration. */
  readonly dbxAnalyticsSegmentApiServiceConfigFactory: DbxAnalyticsSegmentApiServiceConfigFactory;
}

/**
 * Creates Angular environment providers that register {@link DbxAnalyticsSegmentApiService} for Segment analytics integration.
 *
 * Use alongside {@link provideDbxAnalyticsService} to wire Segment as an analytics listener.
 *
 * @param config - Segment-specific configuration including the write key factory
 * @returns environment providers for Segment analytics
 *
 * @example
 * ```ts
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDbxAnalyticsSegmentApiService({
 *       dbxAnalyticsSegmentApiServiceConfigFactory: (injector) => {
 *         const config = new DbxAnalyticsSegmentApiServiceConfig(environment.analytics.segment);
 *         config.active = environment.production;
 *         config.logging = !environment.production;
 *         return config;
 *       }
 *     }),
 *     provideDbxAnalyticsService({
 *       dbxAnalyticsServiceConfigurationFactory: (injector) => ({
 *         isProduction: environment.production,
 *         listeners: [injector.get(DbxAnalyticsSegmentServiceListener)]
 *       })
 *     })
 *   ]
 * };
 * ```
 */
export function provideDbxAnalyticsSegmentApiService(config: ProvideDbxAnalyticsSegmentModuleConfig): EnvironmentProviders {
  const { preloadSegmentToken, dbxAnalyticsSegmentApiServiceConfigFactory } = config;

  const providers: Provider[] = [
    // configuration
    {
      provide: DbxAnalyticsSegmentApiServiceConfig,
      useFactory: dbxAnalyticsSegmentApiServiceConfigFactory,
      deps: [Injector]
    },
    // service
    DbxAnalyticsSegmentApiService
  ];

  if (preloadSegmentToken) {
    providers.push({
      provide: PRELOAD_SEGMENT_TOKEN,
      useValue: preloadSegmentToken
    });
  }

  return makeEnvironmentProviders(providers);
}
