import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { provideDbxAppAuthState } from './auth.state.providers';
import { provideDbxAppAuthRouter, ProvideDbxAppAuthRouterConfig } from './router/auth.router.providers';
import { provideDbxAppAuthRouterState, ProvideDbxAppAuthRouterStateConfig } from './router/state/auth.router.state.providers';

export interface ProvideDbxAppAuthConfig extends ProvideDbxAppAuthRouterConfig, ProvideDbxAppAuthRouterStateConfig {}

/**
 * The "all-in-one" provider for an app's dbx-core auth providers.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
 */
export function provideDbxAppAuth(config: ProvideDbxAppAuthConfig): EnvironmentProviders {
  const { dbxAppAuthRoutes, activeRoutesToApplyEffects } = config;

  const providers: (Provider | EnvironmentProviders)[] = [provideDbxAppAuthState(), provideDbxAppAuthRouter({ dbxAppAuthRoutes }), provideDbxAppAuthRouterState({ activeRoutesToApplyEffects })];

  return makeEnvironmentProviders(providers);
}
