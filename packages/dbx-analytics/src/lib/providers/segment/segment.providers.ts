import { type EnvironmentProviders, Injector, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxAnalyticsSegmentApiService, DbxAnalyticsSegmentApiServiceConfig, PRELOAD_SEGMENT_TOKEN } from './segment.service';

export type DbxAnalyticsSegmentApiServiceConfigFactory = (injector: Injector) => DbxAnalyticsSegmentApiServiceConfig;

/**
 * Configuration for provideDbxAnalyticsSegmentApiService()
 */
export interface ProvideDbxAnalyticsSegmentModuleConfig {
  readonly preloadSegmentToken?: boolean;
  readonly dbxAnalyticsSegmentApiServiceConfigFactory: DbxAnalyticsSegmentApiServiceConfigFactory;
}

/**
 * Creates a EnvironmentProviders that provides a DbxAnalyticsSegmentApiService.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
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
