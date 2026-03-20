import { type Action, combineReducers, createFeatureSelector, createSelector } from '@ngrx/store';

import * as fromDbxAppContextState from './data.reducer';

/**
 * Global feature key for our app.
 */
export const FEATURE_KEY = 'app.context';

/**
 * This is a "feature state", which in this case is a single feature (our app state), but could include keys/states within this feature.
 */
export interface DbxAppContextFeatureState {
  [fromDbxAppContextState.DBX_APP_CONTEXT_STATE_FEATURE_KEY]: fromDbxAppContextState.DbxAppContextStateData;
}

/**
 * Interface typing extension for the DbxAppContextFeatureState, and the typing information for how this feature extends the base state.
 */
export interface State {
  [FEATURE_KEY]: DbxAppContextFeatureState;
}

/**
 * Reducers mapping for the DbxAppContextFeatureState
 *
 * @param state - The current feature state, or undefined for initialization.
 * @param action - The dispatched action to reduce.
 * @returns The updated feature state.
 */
export function reducers(state: DbxAppContextFeatureState | undefined, action: Action) {
  return combineReducers({
    [fromDbxAppContextState.DBX_APP_CONTEXT_STATE_FEATURE_KEY]: fromDbxAppContextState.reducer
  })(state, action);
}

/**
 * Selects the DbxAppContextFeatureState feature context.
 *
 * Used by createSelector() to retrieve more specific data from the DbxAppContextFeatureState.
 */
export const selectAppContextFeature = createFeatureSelector<DbxAppContextFeatureState>(FEATURE_KEY);

/**
 * Selector to retrieve the state value from our DbxAppContextStateData in our DbxAppContextFeatureState.
 */
export const selectDbxAppContextState = createSelector(selectAppContextFeature, (featureState: DbxAppContextFeatureState) => featureState[fromDbxAppContextState.DBX_APP_CONTEXT_STATE_FEATURE_KEY].state);
