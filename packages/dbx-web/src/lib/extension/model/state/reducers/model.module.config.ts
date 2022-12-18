import { ArrayOrValue, useIterableOrValue } from '@dereekb/util';
import { createReducer, on } from '@ngrx/store';

import { DbxModelStateActions } from '../actions';
import { DbxModelModuleStateConfiguration, DbxModelModuleStateTypeConfiguration } from '../config';

export const stateFeatureKey = 'object.module.config';

export const initialState: DbxModelModuleStateConfiguration = {
  types: {}
};

export const reducer = createReducer(
  initialState,
  on(DbxModelStateActions.dbxModelResetState, () => initialState),
  on(DbxModelStateActions.dbxModelAddTypeConfiguration, (state, configs) => addModelTypeConfigsToTypes(state, configs))
);

function addModelTypeConfigsToTypes(state: DbxModelModuleStateConfiguration, configs: ArrayOrValue<DbxModelModuleStateTypeConfiguration>) {
  const types = {
    ...state.types
  };

  useIterableOrValue(configs, (config) => {
    types[config.modelType] = config;
  });

  return {
    ...state,
    types
  };
}
