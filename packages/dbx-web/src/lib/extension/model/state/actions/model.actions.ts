import { type Maybe, type ModelKeyTypeNamePair } from '@dereekb/util';
import { createAction, props } from '@ngrx/store';

/**
 * Parameters for dispatching a model object viewed event through the NgRx store.
 */
export interface DbxModelObjectViewedParams {
  readonly modelKeyTypeNamePair: ModelKeyTypeNamePair;
  readonly context?: Maybe<string>;
}

/**
 * Parameters for navigating to a model object's view.
 */
export interface DbxModelGoToObjectViewParams {
  readonly modelKeyTypeNamePair: ModelKeyTypeNamePair;
}

/**
 * NgRx action dispatched when a model object is viewed, carrying the model key/type pair and optional context.
 */
export const emitObjectViewEvent = createAction('[App/Model/Type] Object Viewed', props<DbxModelObjectViewedParams>());
