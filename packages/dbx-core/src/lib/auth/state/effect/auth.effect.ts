import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { DbxAuthService } from '../../service/auth.service';
import { onDbxAppAuth } from '../';
import { map, tap } from 'rxjs';
import type * as fromDbxAppAuth from '../reducer';

/**
 * NgRx effects class that bridges the {@link DbxAuthService} observables into the NgRx store.
 *
 * This effects class serves two purposes:
 * 1. **Event forwarding**: Listens to the auth service's reactive streams (login/logout events,
 *    user state, roles, onboarding status, user identifier) and dispatches corresponding NgRx actions
 *    to keep the store in sync with the auth provider.
 * 2. **Command handling**: Listens for the `logout` command action and forwards it to
 *    {@link DbxAuthService.logOut} to perform the actual logout.
 *
 * This is registered via {@link provideDbxAppAuthState} and should not be provided manually.
 *
 * @see {@link DbxAuthService} for the source observables.
 * @see {@link DbxAppAuthActions} for the auth lifecycle actions.
 * @see {@link DbxAppAuthUserActions} for the user state actions.
 */
@Injectable()
export class DbxAppAuthEffects {
  private readonly dbxAuthService = inject(DbxAuthService);
  protected readonly actions$ = inject(Actions);
  protected readonly store = inject(Store<fromDbxAppAuth.State>);

  // MARK: Auth
  /** Dispatches {@link DbxAppAuthActions.loggedIn} when the auth service emits a login event. */
  readonly emitLoggedIn = createEffect(() => this.dbxAuthService.onLogIn$.pipe(map(() => onDbxAppAuth.DbxAppAuthActions.loggedIn())));

  /** Dispatches {@link DbxAppAuthActions.loggedOut} when the auth service emits a logout event. */
  readonly emitLoggedOut = createEffect(() => this.dbxAuthService.onLogOut$.pipe(map(() => onDbxAppAuth.DbxAppAuthActions.loggedOut())));

  /** Forwards the {@link DbxAppAuthActions.logout} command to {@link DbxAuthService.logOut}. */
  readonly forwardLogoutToAuthService = createEffect(
    () =>
      this.actions$.pipe(
        ofType(onDbxAppAuth.DbxAppAuthActions.logout),
        tap(() => {
          // Perform the logout
          this.dbxAuthService.logOut();
        })
      ),
    { dispatch: false }
  );

  // MARK: User
  /** Syncs the user identifier from the auth service into the NgRx store. */
  readonly setUserIdentifier = createEffect(() => this.dbxAuthService.userIdentifier$.pipe(map((id) => onDbxAppAuth.DbxAppAuthUserActions.setUserIdentifier({ id }))));

  /** Syncs the user's {@link AuthUserState} from the auth service into the NgRx store. */
  readonly setUserState = createEffect(() => this.dbxAuthService.authUserState$.pipe(map((state) => onDbxAppAuth.DbxAppAuthUserActions.setUserState({ state }))));

  /** Syncs the user's auth roles from the auth service into the NgRx store. */
  readonly setUserRoles = createEffect(() => this.dbxAuthService.authRoles$.pipe(map((roles) => onDbxAppAuth.DbxAppAuthUserActions.setUserRoles({ roles: Array.from(roles ?? []) }))));

  /** Syncs the user's onboarding status from the auth service into the NgRx store. */
  readonly setUserIsOnboarded = createEffect(() => this.dbxAuthService.isOnboarded$.pipe(map((isOnboarded) => onDbxAppAuth.DbxAppAuthUserActions.setUserIsOnboarded({ isOnboarded }))));
}
