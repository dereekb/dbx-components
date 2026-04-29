import { type EnvironmentProviders, Injector, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxAnalyticsMixpanelApiService, DbxAnalyticsMixpanelApiServiceConfig, PRELOAD_MIXPANEL_TOKEN } from './mixpanel.service';

/**
 * Factory function that creates a {@link DbxAnalyticsMixpanelApiServiceConfig} using the Angular injector.
 *
 * Used by {@link provideDbxAnalyticsMixpanelApiService} to defer Mixpanel configuration to runtime.
 */
export type DbxAnalyticsMixpanelApiServiceConfigFactory = (injector: Injector) => DbxAnalyticsMixpanelApiServiceConfig;

/**
 * Configuration for {@link provideDbxAnalyticsMixpanelApiService}.
 */
export interface ProvideDbxAnalyticsMixpanelModuleConfig {
  /**
   * Whether to preload the Mixpanel script token.
   *
   * Rarely needed — Mixpanel is typically loaded by Segment's device-mode destination.
   */
  readonly preloadMixpanelToken?: boolean;
  /**
   * Factory function that produces the Mixpanel API service configuration.
   */
  readonly dbxAnalyticsMixpanelApiServiceConfigFactory: DbxAnalyticsMixpanelApiServiceConfigFactory;
}

/**
 * Creates Angular environment providers that register {@link DbxAnalyticsMixpanelApiService} for Mixpanel session-replay control.
 *
 * Use alongside {@link provideDbxAnalyticsService} to wire Mixpanel as an analytics listener that
 * handles session-replay start/stop/pause/resume events.
 *
 * @param config - Mixpanel-specific configuration
 * @returns environment providers for Mixpanel analytics
 *
 * @example
 * ```ts
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideDbxAnalyticsMixpanelApiService({
 *       dbxAnalyticsMixpanelApiServiceConfigFactory: () => {
 *         const config = new DbxAnalyticsMixpanelApiServiceConfig();
 *         config.active = environment.production;
 *         return config;
 *       }
 *     }),
 *     provideDbxAnalyticsService({
 *       dbxAnalyticsServiceConfigurationFactory: (injector) => ({
 *         isProduction: environment.production,
 *         listeners: [
 *           injector.get(DbxAnalyticsSegmentServiceListener),
 *           injector.get(DbxAnalyticsMixpanelServiceListener)
 *         ]
 *       })
 *     })
 *   ]
 * };
 * ```
 */
export function provideDbxAnalyticsMixpanelApiService(config: ProvideDbxAnalyticsMixpanelModuleConfig): EnvironmentProviders {
  const { preloadMixpanelToken, dbxAnalyticsMixpanelApiServiceConfigFactory } = config;

  const providers: Provider[] = [
    // configuration
    {
      provide: DbxAnalyticsMixpanelApiServiceConfig,
      useFactory: dbxAnalyticsMixpanelApiServiceConfigFactory,
      deps: [Injector]
    },
    // service
    DbxAnalyticsMixpanelApiService
  ];

  if (preloadMixpanelToken) {
    providers.push({
      provide: PRELOAD_MIXPANEL_TOKEN,
      useValue: preloadMixpanelToken
    });
  }

  return makeEnvironmentProviders(providers);
}
