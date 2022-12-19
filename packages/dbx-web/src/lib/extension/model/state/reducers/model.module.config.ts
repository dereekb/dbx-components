import { ArrayOrValue, useIterableOrValue } from '@dereekb/util';
import { createReducer, on } from '@ngrx/store';

import { DbxModelStateActions } from '../actions';

export interface DbxModelModuleStateConfiguration {}

export const stateFeatureKey = 'model.module.config';

export const initialState: DbxModelModuleStateConfiguration = {
  types: {}
};

export const reducer = createReducer(
  initialState,
  on(DbxModelStateActions.dbxModelResetState, () => initialState)
);
