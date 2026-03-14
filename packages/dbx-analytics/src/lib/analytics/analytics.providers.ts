import { type EnvironmentProviders, Injector, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxAnalyticsServiceConfiguration, DbxAnalyticsService } from './analytics.service';

/**
 * Factory function that creates a {@link DbxAnalyticsServiceConfiguration} using the Angular injector.
 *
 * Used by {@link provideDbxAnalyticsService} to defer configuration resolution to runtime.
 */
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
