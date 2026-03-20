import { type EnvironmentProviders, type Injector, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxLinkifyServiceConfig } from './linkify.service';

/**
 * Factory for DbxLinkifyServiceConfig.
 */
export type DbxLinkifyServiceConfigFactory = (injector: Injector) => DbxLinkifyServiceConfig;

/**
 * Configuration for provideDbxLinkify().
 */
export interface ProvideDbxLinkifyConfig {
  /**
   * Factory for DbxLinkifyServiceConfig.
   */
  readonly dbxLinkifyServiceConfigFactory: DbxLinkifyServiceConfigFactory;
}

/**
 * Creates environment-level providers for configuring {@link DbxLinkifyService} with a custom factory.
 *
 * @example
 * ```ts
 * provideDbxLinkify({
 *   dbxLinkifyServiceConfigFactory: (injector) => ({
 *     defaultEntry: { options: { defaultProtocol: 'https' } },
 *     entries: [{ type: 'bio', options: { target: { url: '_blank' } } }]
 *   })
 * });
 * ```
 *
 * @param config - configuration containing the factory function for creating the linkify service config
 * @returns environment providers that register the DbxLinkifyServiceConfig
 */
export function provideDbxLinkify(config: ProvideDbxLinkifyConfig): EnvironmentProviders {
  const { dbxLinkifyServiceConfigFactory } = config;

  const providers: Provider[] = [
    {
      provide: DbxLinkifyServiceConfig,
      useFactory: dbxLinkifyServiceConfigFactory
    }
  ];

  return makeEnvironmentProviders(providers);
}
