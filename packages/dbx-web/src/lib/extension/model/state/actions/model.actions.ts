import { ModelKeyTypeNamePair, ModelKeyTypePair } from '@dereekb/util';
import { createAction, props } from '@ngrx/store';

export interface DbxModelObjectViewedParams {
  modelKeyTypeNamePair: ModelKeyTypeNamePair;
}

export interface DbxModelGoToObjectViewParams {
  modelKeyTypePair: ModelKeyTypePair;
}

export const emitObjectViewEvent = createAction('[App/Model/Type] Object Viewed', props<DbxModelObjectViewedParams>());
