import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { DbxAppContextState } from './context';
import { onDbxAppContext, fromDbxAppContext } from './state';
import { DbxAppContextFullState } from './state/state';

/**
 * State for accessing the app's DbxAppContextState defined within the DbxAppContextFullState for the ngrx store.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppContextService {
  readonly store = inject(Store<DbxAppContextFullState>);
  readonly state$ = this.store.select(fromDbxAppContext.selectDbxAppContextState);

  setState(state: DbxAppContextState) {
    this.store.dispatch(onDbxAppContext.DbxAppContextActions.setState({ state }));
  }

  resetState() {
    this.store.next(onDbxAppContext.DbxAppContextActions.resetState());
  }
}
