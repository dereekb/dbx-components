import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxAppAuthRoutes } from './auth.router';

/**
 * Configuration for {@link provideDbxAppAuthRouter}.
 *
 * @see {@link DbxAppAuthRoutes} for the route definitions.
 */
export interface ProvideDbxAppAuthRouterConfig {
  /**
   * The concrete {@link DbxAppAuthRoutes} instance that defines the application's auth-related routes
   * (login, logout, onboarding, and main app).
   */
  readonly dbxAppAuthRoutes: DbxAppAuthRoutes;
}

/**
 * Creates Angular `EnvironmentProviders` that register the {@link DbxAppAuthRoutes} configuration.
 *
 * This makes the auth routes available for injection throughout the application,
 * primarily consumed by {@link DbxAppAuthRouterService} for programmatic navigation.
 *
 * @param config - Configuration containing the auth routes to register.
 * @returns Angular `EnvironmentProviders` for the auth router.
 *
 * @example
 * ```ts
 * provideDbxAppAuthRouter({
 *   dbxAppAuthRoutes: {
 *     loginRef: '/auth/login',
 *     appRef: '/app'
 *   }
 * });
 * ```
 *
 * @see {@link provideDbxAppAuth} for the all-in-one provider that includes this.
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
