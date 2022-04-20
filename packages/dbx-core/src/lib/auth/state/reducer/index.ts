import {
  Action,
  combineReducers,
  createFeatureSelector,
  createSelector,
} from '@ngrx/store';

import * as fromDbxAppAuthUserState from './user.reducer';

/**
 * Global feature key
 */
export const featureKey = 'app.auth';

export interface DbxAppAuthFeatureState {
  [fromDbxAppAuthUserState.dbxAppAuthUserFeatureKey]: fromDbxAppAuthUserState.DbxAppAuthStateUser;
}

/**
 * Interface typing extension for the DbxAppAuthFeatureState, and the typing information for how this feature extends the base state.
 */
export interface State {
  [featureKey]: DbxAppAuthFeatureState;
}

/**
 * Reducers mapping for the DbxAppAuthFeatureState
 */
export function reducers(state: DbxAppAuthFeatureState | undefined, action: Action) {
  return combineReducers({
    [fromDbxAppAuthUserState.dbxAppAuthUserFeatureKey]: fromDbxAppAuthUserState.reducer
  })(state, action);
}

/**
 * Selects the DbxAppAuthFeatureState feature context.
 */
export const selectAppAuthFeature = createFeatureSelector<DbxAppAuthFeatureState>(
  featureKey
);

/**
 * Selector to retrieve the state value from our DbxAppContextStateData in our DbxAppContextFeatureState.
 */
export const selectDbxAppAuthUser = createSelector(
  selectAppAuthFeature,
  (featureState: DbxAppAuthFeatureState) => featureState[fromDbxAppAuthUserState.dbxAppAuthUserFeatureKey]
);
