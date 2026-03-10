import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { type ArrayOrValue } from '@dereekb/util';
import { provideEffects } from '@ngrx/effects';
import { type DbxAppContextState } from '../../../context';
import { DbxAppAuthRouterEffects, DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN } from './effect/auth.router.state.effect';

/**
 * Configuration for {@link provideDbxAppAuthRouterState}.
 *
 * @see {@link DbxAppAuthRouterEffects} for the effects that use this configuration.
 */
export interface ProvideDbxAppAuthRouterStateConfig {
  /**
   * Application context states during which the auth router effects should be active.
   *
   * When the app is in one of these states, effects like automatic redirect on login/logout
   * will be applied. Typically set to `['root']` or {@link DBX_KNOWN_APP_CONTEXT_STATES}.
   */
  readonly activeRoutesToApplyEffects: ArrayOrValue<DbxAppContextState>;
}

/**
 * Creates Angular `EnvironmentProviders` that register the auth router state effects
 * and their configuration.
 *
 * This provisions the {@link DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN} with the active states
 * and registers the {@link DbxAppAuthRouterEffects} NgRx effects class.
 *
 * @param config - Configuration specifying which app context states activate the auth router effects.
 * @returns Angular `EnvironmentProviders` for the auth router state effects.
 *
 * @example
 * ```ts
 * provideDbxAppAuthRouterState({
 *   activeRoutesToApplyEffects: ['root']
 * });
 * ```
 *
 * @see {@link provideDbxAppAuth} for the all-in-one provider that includes this.
 * @see {@link DbxAppAuthRouterEffects} for the effects that handle auth-based navigation.
 */
export function provideDbxAppAuthRouterState(config: ProvideDbxAppAuthRouterStateConfig): EnvironmentProviders {
  const { activeRoutesToApplyEffects } = config;

  const providers: (Provider | EnvironmentProviders)[] = [
    // Token for effects
    {
      provide: DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN,
      useValue: activeRoutesToApplyEffects
    },
    // Effects
    provideEffects(DbxAppAuthRouterEffects)
  ];

  return makeEnvironmentProviders(providers);
}
