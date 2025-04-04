import { Maybe, ModelKeyTypeNamePair, ModelKeyTypePair } from '@dereekb/util';
import { createAction, props } from '@ngrx/store';

export interface DbxModelObjectViewedParams {
  readonly modelKeyTypeNamePair: ModelKeyTypeNamePair;
  readonly context?: Maybe<string>;
}

export interface DbxModelGoToObjectViewParams {
  readonly modelKeyTypeNamePair: ModelKeyTypeNamePair;
}

export const emitObjectViewEvent = createAction('[App/Model/Type] Object Viewed', props<DbxModelObjectViewedParams>());
