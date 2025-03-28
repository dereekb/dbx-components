import { EnvironmentProviders, importProvidersFrom, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { fromDbxAppAuth } from './state';
import { DbxAppAuthEffects } from './state/effect/auth.effect';

/**
 * Creates EnvironmentProviders for providing the DbxAppAuth state and effects.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxAppAuthState(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(fromDbxAppAuth.featureKey, fromDbxAppAuth.reducers), provideEffects(DbxAppAuthEffects)]);
}
