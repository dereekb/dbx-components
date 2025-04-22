import { EnvironmentProviders, Injector, Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxAnalyticsServiceConfiguration, DbxAnalyticsService } from './analytics.service';

export type DbxAnalyticsServiceConfigurationFactory = (injector: Injector) => DbxAnalyticsServiceConfiguration;

/**
 * Configuration for provideDbxAnalyticsService()
 */
export interface ProvideDbxAnalyticsConfig {
  readonly dbxAnalyticsServiceConfigurationFactory: DbxAnalyticsServiceConfigurationFactory;
}

/**
 * Creates a EnvironmentProviders that provides a DbxAnalyticsService.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxAnalyticsService(config: ProvideDbxAnalyticsConfig): EnvironmentProviders {
  const { dbxAnalyticsServiceConfigurationFactory } = config;

  const providers: Provider[] = [
    // configuration
    {
      provide: DbxAnalyticsServiceConfiguration,
      useFactory: dbxAnalyticsServiceConfigurationFactory,
      deps: [Injector]
    },
    // service
    DbxAnalyticsService
  ];

  return makeEnvironmentProviders(providers);
}
