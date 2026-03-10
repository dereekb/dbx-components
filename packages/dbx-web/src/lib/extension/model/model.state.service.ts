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
   */
  emitModelViewEvent({ modelKeyTypeNamePair, context }: DbxModelObjectViewedParams): void {
    this.store.dispatch(onDbxModel.DbxModelStateModelActions.emitObjectViewEvent({ modelKeyTypeNamePair, context }));
  }
}
