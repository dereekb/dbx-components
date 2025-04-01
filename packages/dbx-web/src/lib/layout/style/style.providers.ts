import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { DBX_STYLE_DEFAULT_CONFIG_TOKEN, DbxStyleService } from './style.service';
import { DbxStyleConfig } from './style';

/**
 * Configuration for provideDbxStyleService().
 */
export interface ProvideDbxStyleServiceConfig {
  /**
   * Default style configuration, if applicable.
   *
   * If null, the DbxStyleService will not have a default style
   */
  readonly dbxStyleConfig: DbxStyleConfig | null;
}

/**
 * Provides EnvironmentalProviders for a DbxStyleService and the default config.
 *
 * @returns
 */
export function provideDbxStyleService(config: ProvideDbxStyleServiceConfig): EnvironmentProviders {
  const { dbxStyleConfig } = config;

  const providers: Provider[] = [
    // config
    {
      provide: DBX_STYLE_DEFAULT_CONFIG_TOKEN,
      useValue: dbxStyleConfig
    },
    // service
    DbxStyleService
  ];

  return makeEnvironmentProviders(providers);
}
