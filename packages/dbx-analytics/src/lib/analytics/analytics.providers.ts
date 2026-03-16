import { type EnvironmentProviders, Injector, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxAnalyticsServiceConfiguration, DbxAnalyticsService } from './analytics.service';

/**
 * Factory function that creates a {@link DbxAnalyticsServiceConfiguration} using the Angular injector.
 *
 * Used by {@link provideDbxAnalyticsService} to defer configuration resolution to runtime.
 */
export type DbxAnalyticsServiceConfigurationFactory = (injector: Injector) => DbxAnalyticsServiceConfiguration;

/**
 * Configuration for {@link provideDbxAnalyticsService}.
 */
export interface ProvideDbxAnalyticsConfig {
  readonly dbxAnalyticsServiceConfigurationFactory: DbxAnalyticsServiceConfigurationFactory;
}

/**
 * Creates Angular environment providers that register {@link DbxAnalyticsService} and its configuration.
 *
 * Call this in your application's `providers` array to set up analytics with a custom configuration factory
 * that resolves listeners, user sources, and environment flags at runtime.
 *
 * @param config - contains the factory function that produces a {@link DbxAnalyticsServiceConfiguration}
 * @returns environment providers for the analytics service
 *
 * @example
 * ```ts
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDbxAnalyticsService({
 *       dbxAnalyticsServiceConfigurationFactory: (injector: Injector) => ({
 *         isProduction: environment.production,
 *         logEvents: !environment.production,
 *         listeners: [injector.get(DbxAnalyticsSegmentServiceListener)],
 *         userSource: injector.get(DbxFirebaseAnalyticsUserSource)
 *       })
 *     })
 *   ]
 * };
 * ```
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
