import { EnvironmentProviders, Injector, Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxFirebaseModelTypesService, DbxFirebaseModelTypesServiceConfig } from './model.types.service';

/**
 * Factory for DbxFirebaseModelTypesServiceConfig.
 */
export type DbxFirebaseModelTypesServiceConfigFactory = (injector: Injector) => DbxFirebaseModelTypesServiceConfig;

/**
 * Configuration for provideDbxFirebaseModelTypesService().
 */
export interface ProvideDbxFirebaseModelTypesServiceConfig {
  readonly dbxFirebaseModelTypesServiceConfigFactory: DbxFirebaseModelTypesServiceConfigFactory;
}

/**
 * Creates EnvironmentProviders for DbxFirebaseModelTypesService.
 *
 * @param config
 * @returns
 */
export function provideDbxFirebaseModelTypesService(config: ProvideDbxFirebaseModelTypesServiceConfig): EnvironmentProviders {
  const { dbxFirebaseModelTypesServiceConfigFactory } = config;

  const providers: Provider[] = [
    {
      provide: DbxFirebaseModelTypesServiceConfig,
      useFactory: dbxFirebaseModelTypesServiceConfigFactory
    },
    DbxFirebaseModelTypesService
  ];

  return makeEnvironmentProviders(providers);
}
