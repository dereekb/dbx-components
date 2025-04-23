import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { onDbxModel } from './state';
import { DbxModelObjectViewedParams } from './state/actions/model.actions';
import { DbxModelFullState } from './state/state';

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
