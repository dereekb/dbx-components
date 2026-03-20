import { type Action, combineReducers, createFeatureSelector, createSelector } from '@ngrx/store';

import * as fromObjectModuleConfig from './model.module.config';
import { type DbxModelModuleStateConfiguration } from './model.module.config';

export const FEATURE_KEY = 'app.model';

export interface DbxModelState {
  [fromObjectModuleConfig.STATE_FEATURE_KEY]: DbxModelModuleStateConfiguration;
}

export interface State {
  [FEATURE_KEY]: DbxModelState;
}

/**
 * Combined reducer for the DbxModel NgRx feature state, delegating to sub-reducers for each state slice.
 *
 * @param state The current DbxModel feature state, or undefined for initial state
 * @param action The NgRx action to process
 * @returns The new DbxModelState produced by the combined sub-reducers
 */
export function reducers(state: DbxModelState | undefined, action: Action) {
  return combineReducers({
    [fromObjectModuleConfig.STATE_FEATURE_KEY]: fromObjectModuleConfig.reducer
  })(state, action);
}

// MARK: Context
// eslint-disable-next-line @typescript-eslint/no-deprecated
export const selectDbxModelFeature = createFeatureSelector<State, DbxModelState>(FEATURE_KEY);

// MARK: Module Config
export const selectDbxModelFeatureObjectModuleConfig = createSelector(selectDbxModelFeature, (state: DbxModelState) => state[fromObjectModuleConfig.STATE_FEATURE_KEY]);

// COMPAT: Deprecated aliases
/**
 * @deprecated use FEATURE_KEY instead.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const featureKey = FEATURE_KEY;
