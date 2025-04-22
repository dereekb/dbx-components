import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideState } from '@ngrx/store';
import { fromDbxAppContext } from './state';

/**
 * Creates EnvironmentProviders for providing the DbxAppContext state.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxAppContextState(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(fromDbxAppContext.featureKey, fromDbxAppContext.reducers)]);
}
