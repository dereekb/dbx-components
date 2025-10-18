import { createAction, props } from '@ngrx/store';
import { type DbxAppContextState } from '../../context';

/**
 * Action to set the current DbxAppContextState value.
 */
export const setState = createAction('[App/Context] Set State', props<{ state: DbxAppContextState }>());

/**
 * Resets the app back to the init context.
 */
export const resetState = createAction('[App/Context] Reset');
