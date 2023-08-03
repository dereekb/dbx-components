import { BehaviorSubject } from 'rxjs';
import { Injectable, OnDestroy } from '@angular/core';
import { goWithRouter } from '../../router';
import { DbxRouterService } from '../../router/router/service/router.service';
import { DbxAppAuthRoutes } from './auth.router';

/**
 * Helper service for navigating to important auth-related routes.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppAuthRouterService implements OnDestroy {
  private _isAuthRouterEffectsEnabled = new BehaviorSubject<boolean>(true);

  readonly isAuthRouterEffectsEnabled$ = this._isAuthRouterEffectsEnabled.asObservable();

  constructor(readonly dbxRouterService: DbxRouterService, readonly dbxAppAuthRoutes: DbxAppAuthRoutes) {}

  ngOnDestroy(): void {
    this._isAuthRouterEffectsEnabled.complete();
  }

  get hasOnboardingState(): boolean {
    return Boolean(this.dbxAppAuthRoutes.onboardRef);
  }

  // MARK: Effects

  /**
   * Whether or not DbxAppAuthRouterEffects are enabled.
   */
  get isAuthRouterEffectsEnabled(): boolean {
    return this._isAuthRouterEffectsEnabled.value;
  }

  set isAuthRouterEffectsEnabled(enabled: boolean) {
    this._isAuthRouterEffectsEnabled.next(enabled);
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
