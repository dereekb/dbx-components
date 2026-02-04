import { type EnvironmentProviders, type Injector, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxFirebaseModelEntitiesWidgetService, DbxFirebaseModelEntitiesWidgetServiceConfig } from './model.entities.widget.service';

/**
 * Factory for DbxFirebaseModelEntitiesWidgetServiceConfig.
 */
export type DbxFirebaseModelEntitiesWidgetServiceConfigFactory = (injector: Injector) => DbxFirebaseModelEntitiesWidgetServiceConfig;

/**
 * Configuration for provideDbxFirebaseModelEntitiesWidgetService().
 */
export interface ProvideDbxFirebaseModelEntitiesWidgetServiceConfig {
  /**
   * Factory for DbxFirebaseModelEntitiesWidgetServiceConfig.
   */
  readonly dbxFirebaseModelEntitiesWidgetServiceConfigFactory: DbxFirebaseModelEntitiesWidgetServiceConfigFactory;
}

/**
 * Creates EnvironmentProviders for DbxFirebaseModelEntitiesWidgetService.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseModelEntitiesWidgetService(config: ProvideDbxFirebaseModelEntitiesWidgetServiceConfig): EnvironmentProviders {
  const { dbxFirebaseModelEntitiesWidgetServiceConfigFactory } = config;

  const providers: Provider[] = [
    {
      provide: DbxFirebaseModelEntitiesWidgetServiceConfig,
      useFactory: dbxFirebaseModelEntitiesWidgetServiceConfigFactory
    },
    DbxFirebaseModelEntitiesWidgetService
  ];

  return makeEnvironmentProviders(providers);
}
