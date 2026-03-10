import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { provideDbxAppAuthState } from './auth.state.providers';
import { provideDbxAppAuthRouter, type ProvideDbxAppAuthRouterConfig } from './router/auth.router.providers';
import { provideDbxAppAuthRouterState, type ProvideDbxAppAuthRouterStateConfig } from './router/state/auth.router.state.providers';

/**
 * Combined configuration for provisioning all dbx-core authentication providers.
 *
 * Merges the configuration requirements from both the auth router and the auth router state
 * into a single interface, simplifying setup when all auth features are needed.
 *
 * @see {@link ProvideDbxAppAuthRouterConfig} for route configuration details.
 * @see {@link ProvideDbxAppAuthRouterStateConfig} for router state effect configuration details.
 *
 * @example
 * ```ts
 * const config: ProvideDbxAppAuthConfig = {
 *   dbxAppAuthRoutes: myAuthRoutes,
 *   activeRoutesToApplyEffects: ['root']
 * };
 * ```
 */
export interface ProvideDbxAppAuthConfig extends ProvideDbxAppAuthRouterConfig, ProvideDbxAppAuthRouterStateConfig {}

/**
 * All-in-one provider function that registers the complete set of dbx-core auth providers.
 *
 * This is the recommended way to set up authentication in a dbx-core application. It provisions:
 * - The NgRx auth state and effects via {@link provideDbxAppAuthState}
 * - The auth router configuration via {@link provideDbxAppAuthRouter}
 * - The auth router state effects via {@link provideDbxAppAuthRouterState}
 *
 * @param config - Combined auth configuration including routes and active states for effects.
 * @returns Angular `EnvironmentProviders` to be included in the application's provider list.
 *
 * @example
 * ```ts
 * // In your app config or module:
 * provideDbxAppAuth({
 *   dbxAppAuthRoutes: {
 *     loginRef: '/login',
 *     appRef: '/app'
 *   },
 *   activeRoutesToApplyEffects: ['root']
 * });
 * ```
 *
 * @see {@link provideDbxAppAuthState}
 * @see {@link provideDbxAppAuthRouter}
 * @see {@link provideDbxAppAuthRouterState}
 */
export function provideDbxAppAuth(config: ProvideDbxAppAuthConfig): EnvironmentProviders {
  const { dbxAppAuthRoutes, activeRoutesToApplyEffects } = config;

  const providers: (Provider | EnvironmentProviders)[] = [provideDbxAppAuthState(), provideDbxAppAuthRouter({ dbxAppAuthRoutes }), provideDbxAppAuthRouterState({ activeRoutesToApplyEffects })];

  return makeEnvironmentProviders(providers);
}
