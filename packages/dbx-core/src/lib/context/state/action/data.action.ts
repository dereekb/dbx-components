import { createAction, props } from '@ngrx/store';
import { DbxAppContextState } from '../../context';

/**
 * Action to set the current DbxAppContextState value.
 */
export const dbxAppContextSetState = createAction('[App/Context] Set State',
  props<{ state: DbxAppContextState }>()
);

/**
 * Resets the app back to the init context.
 */
export const dbxAppContextResetState = createAction('[App/Context] Reset');
