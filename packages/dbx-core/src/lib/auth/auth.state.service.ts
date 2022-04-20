import { Injectable } from "@angular/core";
import { Store } from "@ngrx/store";
import { fromDbxAppAuth } from './state';
import { DbxAppAuthFullState } from "./state/state";


/**
 * State for accessing the app's DbxAppAuthState defined within the DbxAppAuthFullState for the ngrx store.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppAuthStateService {

  readonly authStateUser$ = this.store.select(fromDbxAppAuth.selectDbxAppAuthUser);

  constructor(readonly store: Store<DbxAppAuthFullState>) { }

}
