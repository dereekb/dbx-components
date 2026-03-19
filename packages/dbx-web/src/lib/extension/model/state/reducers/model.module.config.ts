import { createReducer, on } from '@ngrx/store';

import { DbxModelStateActions } from '../actions';

/**
 * NgRx state slice for model module configuration.
 */
export interface DbxModelModuleStateConfiguration {}

/**
 * NgRx feature key for the model module configuration state slice.
 */
export const STATE_FEATURE_KEY = 'model.module.config';

/**
 * Initial state for the model module configuration reducer.
 */
export const INITIAL_STATE: DbxModelModuleStateConfiguration = {
  types: {}
};

/**
 * NgRx reducer for model module configuration. Resets to initial state on {@link DbxModelStateActions.dbxModelResetState}.
 */
export const reducer = createReducer(
  INITIAL_STATE,
  on(DbxModelStateActions.dbxModelResetState, () => INITIAL_STATE)
);

// COMPAT: Deprecated aliases
/** @deprecated use STATE_FEATURE_KEY instead. */
export const stateFeatureKey = STATE_FEATURE_KEY;
/** @deprecated use INITIAL_STATE instead. */
export const initialState = INITIAL_STATE;
