import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { type DbxAppContextState } from './context';
import { onDbxAppContext, fromDbxAppContext } from './state';
import { type DbxAppContextFullState } from './state/state';

/**
 * Service for dispatching and selecting the application's {@link DbxAppContextState} from the NgRx store.
 *
 * Provided at the root level. Use to transition between app-level context states
 * (e.g., public, auth, onboard, app).
 *
 * @example
 * ```typescript
 * @Component({ ... })
 * export class AppComponent {
 *   private readonly contextService = inject(DbxAppContextService);
 *
 *   onLogin(): void {
 *     this.contextService.setState('app');
 *   }
 * }
 * ```
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
