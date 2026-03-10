import { BehaviorSubject } from 'rxjs';
import { Injectable, type OnDestroy, inject } from '@angular/core';
import { goWithRouter } from '../../router/router/service/router.go';
import { DbxRouterService } from '../../router/router/service/router.service';
import { DbxAppAuthRoutes } from './auth.router';

/**
 * Angular service that provides programmatic navigation to key authentication-related routes.
 *
 * This service wraps {@link DbxRouterService} and {@link DbxAppAuthRoutes} to offer
 * convenient methods for navigating to login, logout, onboarding, and main app routes.
 * It also manages an `isAuthRouterEffectsEnabled` flag that controls whether
 * {@link DbxAppAuthRouterEffects} should perform automatic navigation on auth events.
 *
 * @example
 * ```ts
 * @Component({ ... })
 * export class LogoutButtonComponent {
 *   private readonly authRouterService = inject(DbxAppAuthRouterService);
 *
 *   async onLogout() {
 *     await this.authRouterService.goToLoggedOut();
 *   }
 * }
 * ```
 *
 * @see {@link DbxAppAuthRoutes} for the route configuration.
 * @see {@link DbxAppAuthRouterEffects} for automatic navigation on auth state changes.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxAppAuthRouterService implements OnDestroy {
  readonly dbxRouterService = inject(DbxRouterService);
  readonly dbxAppAuthRoutes = inject(DbxAppAuthRoutes);

  private _isAuthRouterEffectsEnabled = new BehaviorSubject<boolean>(true);

  /** Observable of whether auth router effects are currently enabled. */
  readonly isAuthRouterEffectsEnabled$ = this._isAuthRouterEffectsEnabled.asObservable();

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
