import { createReducer, on } from '@ngrx/store';

import { DbxModelStateActions } from '../actions';

/**
 * NgRx state slice for model module configuration.
 */
export interface DbxModelModuleStateConfiguration {}

/**
 * NgRx feature key for the model module configuration state slice.
 */
export const stateFeatureKey = 'model.module.config';

/**
 * Initial state for the model module configuration reducer.
 */
export const initialState: DbxModelModuleStateConfiguration = {
  types: {}
};

/**
 * NgRx reducer for model module configuration. Resets to initial state on {@link DbxModelStateActions.dbxModelResetState}.
 */
export const reducer = createReducer(
  initialState,
  on(DbxModelStateActions.dbxModelResetState, () => initialState)
);
