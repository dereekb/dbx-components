import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DBX_STYLE_DEFAULT_CONFIG_TOKEN, DbxStyleService } from './style.service';
import { DbxColorService, DbxColorServiceConfig } from './style.color.service';
import { type DbxStyleConfig } from './style';

/**
 * Configuration for provideDbxStyleService().
 */
export interface ProvideDbxStyleServiceConfig {
  /**
   * Default style configuration, if applicable.
   *
   * If null, the DbxStyleService will not have a default style
   */
  readonly dbxStyleConfig: Maybe<DbxStyleConfig>;
  /**
   * Optional initial configuration for the {@link DbxColorService}.
   *
   * When provided, seeds the color service with the supplied templates.
   */
  readonly dbxColorServiceConfig?: Maybe<DbxColorServiceConfig>;
}

/**
 * Provides environment-level providers for {@link DbxStyleService}, {@link DbxColorService}, and their default configurations.
 *
 * @param config - Configuration specifying the default style and optional color templates.
 * @returns Environment providers for the style and color services and their default config tokens.
 *
 * @example
 * ```ts
 * provideDbxStyleService({
 *   dbxStyleConfig: { style: 'my-app', suffixes: new Set(['dark']) },
 *   dbxColorServiceConfig: {
 *     templates: [{ key: 'brand-positive', config: { color: '#1f9b59', contrast: 'white', tone: 18 } }]
 *   }
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function provideDbxStyleService(config: ProvideDbxStyleServiceConfig): EnvironmentProviders {
  const { dbxStyleConfig, dbxColorServiceConfig } = config;

  const providers: Provider[] = [
    // config
    {
      provide: DBX_STYLE_DEFAULT_CONFIG_TOKEN,
      useValue: dbxStyleConfig
    },
    // services
    DbxStyleService,
    DbxColorService
  ];

  if (dbxColorServiceConfig) {
    providers.push({
      provide: DbxColorServiceConfig,
      useValue: dbxColorServiceConfig
    });
  }

  return makeEnvironmentProviders(providers);
}
