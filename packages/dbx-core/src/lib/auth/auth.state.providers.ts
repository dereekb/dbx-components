import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { fromDbxAppAuth } from './state';
import { DbxAppAuthEffects } from './state/effect/auth.effect';

/**
 * Creates Angular `EnvironmentProviders` that register the NgRx auth feature state and effects.
 *
 * This provisions the `fromDbxAppAuth` feature reducer and the {@link DbxAppAuthEffects} effects class,
 * which together manage the auth user state (identifier, roles, onboarding status) in the NgRx store.
 *
 * Typically called internally by {@link provideDbxAppAuth}, but can be used independently
 * if only the state management (without router integration) is needed.
 *
 * @returns Angular `EnvironmentProviders` for the auth state feature.
 *
 * @see {@link DbxAppAuthEffects}
 * @see {@link fromDbxAppAuth}
 */
export function provideDbxAppAuthState(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(fromDbxAppAuth.featureKey, fromDbxAppAuth.reducers), provideEffects(DbxAppAuthEffects)]);
}
