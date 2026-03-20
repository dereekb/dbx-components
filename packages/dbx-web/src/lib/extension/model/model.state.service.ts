import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { onDbxModel } from './state';
import { type DbxModelObjectViewedParams } from './state/actions/model.actions';
import { type DbxModelFullState } from './state/state';

/**
 * Service that dispatches model-related NgRx store actions, such as emitting model view events to the store for tracking.
 */
@Injectable()
export class DbxModelObjectStateService {
  readonly store = inject(Store<DbxModelFullState>);

  /**
   * Emit a model viewed event.
   *
   * @param params - The model viewed event parameters
   * @param params.modelKeyTypeNamePair - Identifies the model that was viewed
   * @param params.context - Optional context describing how the model was viewed
   */
  emitModelViewEvent({ modelKeyTypeNamePair, context }: DbxModelObjectViewedParams): void {
    this.store.dispatch(onDbxModel.DbxModelStateModelActions.emitObjectViewEvent({ modelKeyTypeNamePair, context }));
  }
}
