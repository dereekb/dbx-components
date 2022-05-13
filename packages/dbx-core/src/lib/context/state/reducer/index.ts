import {
  Action,
  combineReducers,
  createFeatureSelector,
  createSelector,
} from '@ngrx/store';

import * as fromDbxAppContextState from './data.reducer';

/**
 * Global feature key for our app.
 */
export const featureKey = 'app.context';

/**
 * This is a "feature state", which in this case is a single feature (our app state), but could include keys/states within this feature.
 */
export interface DbxAppContextFeatureState {
  [fromDbxAppContextState.dbxAppContextStateFeatureKey]: fromDbxAppContextState.DbxAppContextStateData;
}

/**
 * Interface typing extension for the DbxAppContextFeatureState, and the typing information for how this feature extends the base state.
 */
export interface State {
  [featureKey]: DbxAppContextFeatureState;
}

/**
 * Reducers mapping for the DbxAppContextFeatureState
 */
export function reducers(state: DbxAppContextFeatureState | undefined, action: Action) {
  return combineReducers({
    [fromDbxAppContextState.dbxAppContextStateFeatureKey]: fromDbxAppContextState.reducer
  })(state, action);
}

/**
 * Selects the DbxAppContextFeatureState feature context.
 * 
 * Used by createSelector() to retrieve more specific data from the DbxAppContextFeatureState.
 */
export const selectAppContextFeature = createFeatureSelector<DbxAppContextFeatureState>(
  featureKey
);

/**
 * Selector to retrieve the state value from our DbxAppContextStateData in our DbxAppContextFeatureState.
 */
export const selectDbxAppContextState = createSelector(
  selectAppContextFeature,
  (featureState: DbxAppContextFeatureState) => featureState[fromDbxAppContextState.dbxAppContextStateFeatureKey].state
);
