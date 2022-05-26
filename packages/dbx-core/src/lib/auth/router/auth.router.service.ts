import { Injectable } from '@angular/core';
import { goWithRouter } from '../../router';
import { DbxRouterService } from '../../router/router/service/router.service';
import { DbxAppAuthRoutes } from './auth.router';

/**
 * Helper service for navigating to important auth-related routes.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppAuthRouterService {
  constructor(readonly dbxRouterService: DbxRouterService, readonly dbxAppAuthRoutes: DbxAppAuthRoutes) {}

  get hasOnboardingState(): boolean {
    return Boolean(this.dbxAppAuthRoutes.onboardRef);
  }

  // MARK: Navigate
  /**
   * Navigates to the login state.
   *
   * @returns
   */
  goToLogin() {
    return goWithRouter(this.dbxRouterService)(this.dbxAppAuthRoutes.loginRef);
  }

  /**
   * Navigates to the logged out state, if it exists, otherwise navigates to the login state.
   *
   * @returns
   */
  goToLoggedOut() {
    return goWithRouter(this.dbxRouterService)(this.dbxAppAuthRoutes.loggedOutRef ?? this.dbxAppAuthRoutes.loginRef);
  }

  /**
   * Navigates to the onboarding state if it is available, otherwise navigates to the app.
   *
   * @returns
   */
  goToOnboarding(): Promise<boolean> {
    return goWithRouter(this.dbxRouterService)(this.dbxAppAuthRoutes.onboardRef ?? this.dbxAppAuthRoutes.appRef);
  }

  /**
   * Navigates to the app state.
   *
   * @returns
   */
  goToApp() {
    return goWithRouter(this.dbxRouterService)(this.dbxAppAuthRoutes.appRef);
  }
}
