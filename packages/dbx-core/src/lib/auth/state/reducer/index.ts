import { type Action, combineReducers, createFeatureSelector, createSelector } from '@ngrx/store';
import * as fromDbxAppAuthUserState from './user.reducer';

/**
 * NgRx feature key used to register the auth feature state in the global store.
 *
 * The auth state is registered under `'app.auth'` in the root NgRx state tree.
 */
export const featureKey = 'app.auth';

/**
 * Shape of the auth feature state slice, containing all auth-related sub-states.
 *
 * Currently contains only the user sub-state ({@link DbxAppAuthStateUser}), but is
 * structured to accommodate additional auth-related sub-features in the future.
 *
 * @see {@link DbxAppAuthStateUser} for the user sub-state shape.
 */
export interface DbxAppAuthFeatureState {
  [fromDbxAppAuthUserState.dbxAppAuthUserFeatureKey]: fromDbxAppAuthUserState.DbxAppAuthStateUser;
}

/**
 * Root state interface extension that declares how the auth feature integrates into the global NgRx store.
 *
 * Use this type when injecting `Store<State>` in effects or services that need typed access
 * to the auth feature selectors.
 *
 * @see {@link DbxAppAuthFullState} for the public alias of this type.
 */
export interface State {
  [featureKey]: DbxAppAuthFeatureState;
}

/**
 * Combined reducer function for the auth feature state.
 *
 * Merges all auth sub-reducers (currently just the user reducer) using NgRx's `combineReducers`.
 * This function is registered with `provideState` via {@link provideDbxAppAuthState}.
 *
 * @param state - The current auth feature state, or `undefined` for initialization.
 * @param action - The dispatched NgRx action.
 * @returns The updated {@link DbxAppAuthFeatureState}.
 */
export function reducers(state: DbxAppAuthFeatureState | undefined, action: Action) {
  return combineReducers({
    [fromDbxAppAuthUserState.dbxAppAuthUserFeatureKey]: fromDbxAppAuthUserState.reducer
  })(state, action);
}

/**
 * NgRx feature selector that retrieves the entire {@link DbxAppAuthFeatureState} from the global store.
 */
export const selectAppAuthFeature = createFeatureSelector<DbxAppAuthFeatureState>(featureKey);

/**
 * NgRx selector that retrieves the {@link DbxAppAuthStateUser} from the auth feature state.
 *
 * Provides access to the user's identifier, auth state, roles, and onboarding status.
 *
 * @see {@link DbxAppAuthStateService.authStateUser$} for the observable wrapper.
 */
export const selectDbxAppAuthUser = createSelector(selectAppAuthFeature, (featureState: DbxAppAuthFeatureState) => featureState[fromDbxAppAuthUserState.dbxAppAuthUserFeatureKey]);
