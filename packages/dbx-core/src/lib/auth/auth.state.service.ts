import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { fromDbxAppAuth } from './state';
import { DbxAppAuthFullState } from './state/state';

/**
 * State for accessing the app's DbxAppAuthState defined within the DbxAppAuthFullState for the ngrx store.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppAuthStateService {
  readonly store = inject(Store<DbxAppAuthFullState>);
  readonly authStateUser$ = this.store.select(fromDbxAppAuth.selectDbxAppAuthUser);
}
