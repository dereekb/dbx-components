import { type ActionReducer, createReducer, type MetaReducer } from '@ngrx/store';
import { environment } from '../../environments/environment';

// tslint:disable-next-line: no-empty-interface
export interface State {
  // None
}

export const initialState: State = {};

export const ROOT_REDUCER = createReducer(initialState);

/**
 * Meta-reducer that logs all dispatched actions, previous state, and next state to the console.
 *
 * @param reducer - The reducer to wrap with logging
 * @returns A wrapped reducer that logs state transitions
 */
export function logger(reducer: ActionReducer<State>): ActionReducer<State> {
  return (state, action) => {
    const result = reducer(state, action);
    console.groupCollapsed(action.type);
    console.log('prev state', state);
    console.log('action', action);
    console.log('next state', result);
    console.groupEnd();
    return result;
  };
}

/**
 * By default, @ngrx/store uses combineReducers with the reducer map to compose
 * the root meta-reducer. To add more meta-reducers, provide an array of meta-reducers
 * that will be composed to form the root meta-reducer.
 */
export const META_REDUCERS: MetaReducer<State>[] = !environment.production ? [logger] : [];
