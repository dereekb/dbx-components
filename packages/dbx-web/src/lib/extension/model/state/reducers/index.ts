import { Action, combineReducers, createFeatureSelector, createSelector } from '@ngrx/store';

import * as fromObjectModuleConfig from './model.module.config';
import { DbxModelModuleStateConfiguration } from './model.module.config';

export const featureKey = 'app.model';

export interface DbxModelState {
  [fromObjectModuleConfig.stateFeatureKey]: DbxModelModuleStateConfiguration;
}

export interface State {
  [featureKey]: DbxModelState;
}

export function reducers(state: DbxModelState | undefined, action: Action) {
  return combineReducers({
    [fromObjectModuleConfig.stateFeatureKey]: fromObjectModuleConfig.reducer
  })(state, action);
}

// MARK: Context
export const selectDbxModelFeature = createFeatureSelector<State, DbxModelState>(featureKey);

// MARK: Module Config
export const selectDbxModelFeatureObjectModuleConfig = createSelector(selectDbxModelFeature, (state: DbxModelState) => state[fromObjectModuleConfig.stateFeatureKey]);
