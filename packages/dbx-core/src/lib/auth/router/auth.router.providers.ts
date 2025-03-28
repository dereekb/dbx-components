import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxAppAuthRoutes } from './auth.router';

/**
 * Configuration for provideDbxAppAuthRouter().
 */
export interface ProvideDbxAppAuthRouterConfig {
  /**
   * DbxAppAuthRoutes configuration.
   */
  readonly dbxAppAuthRoutes: DbxAppAuthRoutes;
}

/**
 * Creates EnvironmentProviders for providing DbxAppAuthRoutes configuration.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxAppAuthRouter(config: ProvideDbxAppAuthRouterConfig): EnvironmentProviders {
  const { dbxAppAuthRoutes } = config;

  const providers: Provider[] = [
    {
      provide: DbxAppAuthRoutes,
      useValue: dbxAppAuthRoutes
    }
  ];

  return makeEnvironmentProviders(providers);
}
