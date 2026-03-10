import { createAction } from '@ngrx/store';

/**
 * NgRx action that resets the model state to its initial configuration.
 */
export const dbxModelResetState = createAction('[App/Model] Reset State');
