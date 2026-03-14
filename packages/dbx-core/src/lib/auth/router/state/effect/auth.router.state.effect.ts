import { exhaustMap, filter, first, switchMap } from 'rxjs';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { createEffect, ofType } from '@ngrx/effects';
import { type DbxAppContextState, DBX_KNOWN_APP_CONTEXT_STATES } from '../../../../context/context';
import { AbstractOnDbxAppContextStateEffects } from '../../../../context/state/effect';
import { type fromDbxAppAuth, onDbxAppAuth } from '../../../state';
import { DbxAppAuthRouterService } from '../../auth.router.service';

/**
 * Angular injection token used to configure which {@link DbxAppContextState} values
 * the {@link DbxAppAuthRouterEffects} should be active for.
 *
 * When provided, the effects will only trigger navigation (e.g., redirect on logout)
 * when the application is in one of the specified context states.
 * Defaults to {@link DBX_KNOWN_APP_CONTEXT_STATES} if not explicitly provided.
 *
 * @see {@link provideDbxAppAuthRouterState} for how this token is provisioned.
 */
export const DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN = new InjectionToken('DbxAppAuthRouterEffectsActiveStates');

/**
 * NgRx effects class that performs automatic navigation when authentication state changes.
 *
 * This effects class handles two key navigation scenarios:
 * - **On logout**: Redirects the user to the login route via {@link DbxAppAuthRouterService.goToLogin}.
 * - **On login**: Redirects the user to the main app route via {@link DbxAppAuthRouterService.goToApp}.
 *
 * Navigation only occurs when:
 * 1. The app is in one of the configured active context states (see {@link DBX_APP_AUTH_ROUTER_EFFECTS_TOKEN}).
 * 2. The {@link DbxAppAuthRouterService.isAuthRouterEffectsEnabled} flag is `true`.
 * 3. The current route is not in the ignored routes set (see {@link DbxAppAuthRouterService.addIgnoredRoute}).
 *
 * Extends {@link AbstractOnDbxAppContextStateEffects} to scope effect activation to specific app states.
 *
 * @see {@link DbxAppAuthRouterService} for the navigation methods used.
 * @see {@link provideDbxAppAuthRouterState} for registration and configuration.
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
        switchMap(() => this.dbxAppAuthRouterService.shouldAuthEffectsRedirect$.pipe(first())),
        filter((shouldRedirect) => shouldRedirect),
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
        switchMap(() => this.dbxAppAuthRouterService.shouldAuthEffectsRedirect$.pipe(first())),
        filter((shouldRedirect) => shouldRedirect),
        exhaustMap(() => this.dbxAppAuthRouterService.goToApp())
      ),
    { dispatch: false }
  );
}
