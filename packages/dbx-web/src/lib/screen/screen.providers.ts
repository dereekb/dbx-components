import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxScreenMediaService, DbxScreenMediaServiceConfig, DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG } from './screen.service';

/**
 * Configuration for provideDbxScreenMediaService().
 */
export interface ProvideDbxScreenMediaServiceConfig {
  readonly config?: DbxScreenMediaServiceConfig;
}

/**
 * Creates Angular environment providers for {@link DbxScreenMediaService} and its configuration.
 *
 * @param config - optional service configuration; uses default breakpoints if omitted
 * @returns environment providers to register in the application bootstrap
 *
 * @example
 * ```ts
 * bootstrapApplication(AppComponent, {
 *   providers: [provideDbxScreenMediaService()]
 * });
 * ```
 */
export function provideDbxScreenMediaService(config: ProvideDbxScreenMediaServiceConfig = {}): EnvironmentProviders {
  const screenConfig = config.config ?? DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG;

  const providers: Provider[] = [
    // config
    {
      provide: DbxScreenMediaServiceConfig,
      useValue: screenConfig
    },
    // service
    DbxScreenMediaService
  ];

  return makeEnvironmentProviders(providers);
}
