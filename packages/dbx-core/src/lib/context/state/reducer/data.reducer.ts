import { createReducer, on } from '@ngrx/store';
import { DbxAppContextState, DBX_INIT_APP_CONTEXT_STATE } from '../../context';
import { DbxAppContextActions } from '../action';

/**
 * The feature key for these items/reducers.
 */
export const dbxAppContextStateFeatureKey = 'data';

/**
 * The typings for this feature.
 */
export interface DbxAppContextStateData {
  state: DbxAppContextState;
}

export const initialState: DbxAppContextStateData = {
  state: DBX_INIT_APP_CONTEXT_STATE
};

export const reducer = createReducer(
  initialState,
  /**
   * When DbxAppContextActions.dbxAppContextSetState is pushed, update the app's state to match the argument state.
   */
  on(DbxAppContextActions.dbxAppContextSetState, (_, { state }) => ({ state }))
);
