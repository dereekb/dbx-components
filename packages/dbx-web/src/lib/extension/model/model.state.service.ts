import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { onDbxModel } from './state';
import { DbxModelObjectViewedParams } from './state/actions/model.actions';
import { DbxModelFullState } from './state/state';

@Injectable({
  providedIn: 'root'
})
export class DbxModelObjectStateService {
  constructor(readonly store: Store<DbxModelFullState>) {}

  /**
   * Emit a model viewed event.
   */
  emitModelViewEvent({ modelKeyTypeNamePair }: DbxModelObjectViewedParams): void {
    this.store.dispatch(onDbxModel.DbxModelStateModelActions.emitObjectViewEvent({ modelKeyTypeNamePair }));
  }
}
