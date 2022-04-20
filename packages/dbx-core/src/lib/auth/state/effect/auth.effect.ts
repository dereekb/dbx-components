import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import * as fromDbxAppAuth from '../reducer';
import { Store } from '@ngrx/store';
import { DbxAuthService } from '../../service';
import { onDbxAppAuth } from '../';
import { map, tap } from 'rxjs';

/**
 * Set of ngrx effects that repeat events from DbxAuthService.
 */
@Injectable()
export class DbxAppAuthEffects {

  constructor(private readonly actions$: Actions, private readonly store: Store<fromDbxAppAuth.State>, private readonly dbxAuthService: DbxAuthService) { }

  // MARK: Auth
  readonly emitLoggedIn = createEffect(() => this.dbxAuthService.onLogIn$
    .pipe(map(() => onDbxAppAuth.DbxAppAuthActions.loggedIn())));

  readonly emitLoggedOut = createEffect(() => this.dbxAuthService.onLogOut$
    .pipe(map(() => onDbxAppAuth.DbxAppAuthActions.loggedOut())));

  readonly forwardLogoutToAuthService = createEffect(() => this.actions$.pipe(
    ofType(onDbxAppAuth.DbxAppAuthActions.logout),
    tap(() => {

      // Perform the logout
      this.dbxAuthService.logOut();

    })
  ), { dispatch: false });

  // MARK: Auth
  readonly setUserIdentifier = createEffect(() => this.dbxAuthService.userIdentifier$
    .pipe(map((id) => onDbxAppAuth.DbxAppAuthUserActions.setUserIdentifier({ id }))));

  readonly setUserState = createEffect(() => this.dbxAuthService.authUserState$
    .pipe(map((state) => onDbxAppAuth.DbxAppAuthUserActions.setUserState({ state }))));

  readonly setUserRoles = createEffect(() => this.dbxAuthService.authRoles$
    .pipe(map((roles) => onDbxAppAuth.DbxAppAuthUserActions.setUserRoles({ roles: Array.from(roles ?? []) }))));

  readonly setUserIsOnboarded = createEffect(() => this.dbxAuthService.isOnboarded$
    .pipe(map((isOnboarded) => onDbxAppAuth.DbxAppAuthUserActions.setUserIsOnboarded({ isOnboarded }))));

}
