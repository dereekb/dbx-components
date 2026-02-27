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
 * Creates EnvironmentProviders for DbxLinkifyService.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
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
