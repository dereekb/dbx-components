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

export function reducers(state: DbxModelState | undefined, action: Action) {
  return combineReducers({
    [fromObjectModuleConfig.STATE_FEATURE_KEY]: fromObjectModuleConfig.reducer
  })(state, action);
}

// MARK: Context
export const selectDbxModelFeature = createFeatureSelector<State, DbxModelState>(FEATURE_KEY);

// MARK: Module Config
export const selectDbxModelFeatureObjectModuleConfig = createSelector(selectDbxModelFeature, (state: DbxModelState) => state[fromObjectModuleConfig.STATE_FEATURE_KEY]);

// COMPAT: Deprecated aliases
/**
 * @deprecated use FEATURE_KEY instead.
 */
export const featureKey = FEATURE_KEY;
