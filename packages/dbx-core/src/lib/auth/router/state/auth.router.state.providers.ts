import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import { ArrayOrValue } from '@dereekb/util';
import { provideEffects } from '@ngrx/effects';
import { DbxAppContextState } from '../../../context';
import { DbxAppAuthRouterEffects, DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN } from './effect/auth.router.state.effect';

/**
 * Configuration for provideDbxAppAuthRouterState().
 */
export interface ProvideDbxAppAuthRouterStateConfig {
  /**
   * Active routes to apply effects to.
   */
  readonly activeRoutesToApplyEffects: ArrayOrValue<DbxAppContextState>;
}

/**
 * Creates EnvironmentProviders for providing DbxAppAuthRouterState configuration and effects.
 *
 * @param config Configuration
 * @returns EnvironmentProviders
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
