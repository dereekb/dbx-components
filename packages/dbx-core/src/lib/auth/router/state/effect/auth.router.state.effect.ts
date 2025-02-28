import { exhaustMap, filter } from 'rxjs';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { ArrayOrValue, type Maybe } from '@dereekb/util';
import { createEffect, ofType } from '@ngrx/effects';
import { DbxAppContextState, DBX_KNOWN_APP_CONTEXT_STATES } from '../../../../context/context';
import { AbstractOnDbxAppContextStateEffects } from '../../../../context/state/effect';
import { fromDbxAppAuth, onDbxAppAuth } from '../../../state';
import { DbxAppAuthRouterService } from '../../auth.router.service';

/**
 * Used by DbxAppAuthRouterEffects to configure the states that should be activve by default.
 */
export const DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN = new InjectionToken('DbxAppAuthRouterEffectsActiveStates');

/**
 * Set of ngrx effects that handle navigation in the app when the auth changes in certain ways.
 *
 * Is configurable via the DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN to choose which states this effect is active or not. By default is equal to DBX_KNOWN_APP_CONTEXT_STATES.
 */
@Injectable()
export class DbxAppAuthRouterEffects extends AbstractOnDbxAppContextStateEffects<fromDbxAppAuth.State> {
  readonly dbxAppAuthRouterService = inject(DbxAppAuthRouterService);

  constructor() {
    super(inject<Maybe<ArrayOrValue<DbxAppContextState>>>(DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN, { optional: true }) ?? DBX_KNOWN_APP_CONTEXT_STATES);
  }

  /**
   * Effect to redirect to the login when logout occurs.
   */
  readonly redirectToLoginOnLogout = createEffect(
    () =>
      this.actions$.pipe(
        ofType(onDbxAppAuth.DbxAppAuthActions.loggedOut),
        filter(() => this.dbxAppAuthRouterService.isAuthRouterEffectsEnabled),
        exhaustMap(() => this.dbxAppAuthRouterService.goToLogin())
      ),
    { dispatch: false }
  );

  /**
   * Effect to redirect to the app when login occurs.
   */
  readonly redirectToOnboardOnLogIn = createEffect(
    () =>
      this.actions$.pipe(
        ofType(onDbxAppAuth.DbxAppAuthActions.loggedIn),
        filter(() => this.dbxAppAuthRouterService.isAuthRouterEffectsEnabled),
        exhaustMap(() => this.dbxAppAuthRouterService.goToApp())
      ),
    { dispatch: false }
  );
}
