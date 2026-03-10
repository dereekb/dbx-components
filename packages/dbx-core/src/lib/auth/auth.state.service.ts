import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { fromDbxAppAuth } from './state';
import { type DbxAppAuthFullState } from './state/state';

/**
 * Angular service that provides access to the current auth user state from the NgRx store.
 *
 * This service acts as a convenience wrapper around the NgRx store, exposing a selector
 * for the {@link DbxAppAuthStateUser} slice of the auth feature state. It is provided
 * at the root level and can be injected anywhere authentication state is needed.
 *
 * @example
 * ```ts
 * @Component({ ... })
 * export class MyComponent {
 *   private readonly authStateService = inject(DbxAppAuthStateService);
 *
 *   readonly user$ = this.authStateService.authStateUser$;
 * }
 * ```
 *
 * @see {@link DbxAppAuthFullState}
 * @see {@link fromDbxAppAuth.selectDbxAppAuthUser}
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppAuthStateService {
  /** NgRx store instance typed to the full auth state. */
  readonly store = inject(Store<DbxAppAuthFullState>);

  /** Observable of the current {@link DbxAppAuthStateUser} from the NgRx store. */
  readonly authStateUser$ = this.store.select(fromDbxAppAuth.selectDbxAppAuthUser);
}
