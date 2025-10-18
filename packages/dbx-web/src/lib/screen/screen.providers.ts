import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxScreenMediaService, DbxScreenMediaServiceConfig, DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG } from './screen.service';

/**
 * Configuration for provideDbxScreenMediaService().
 */
export interface ProvideDbxScreenMediaServiceConfig {
  readonly config?: DbxScreenMediaServiceConfig;
}

/**
 * Creates EnvironmentProviders for providing DbxScreenMediaService and its configuration.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
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
