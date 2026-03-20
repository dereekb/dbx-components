import { BehaviorSubject, combineLatest, distinctUntilChanged, map, type Observable, startWith } from 'rxjs';
import { Injectable, type OnDestroy, inject } from '@angular/core';
import { goWithRouter } from '../../router/router/service/router.go';
import { DbxRouterService } from '../../router/router/service/router.service';
import { type SegueRefOrSegueRefRouterLink } from '../../router/segue';
import { DbxAppAuthRoutes } from './auth.router';

/**
 * Angular service that provides programmatic navigation to key authentication-related routes.
 *
 * This service wraps {@link DbxRouterService} and {@link DbxAppAuthRoutes} to offer
 * convenient methods for navigating to login, logout, onboarding, and main app routes.
 * It also manages an `isAuthRouterEffectsEnabled` flag that controls whether
 * {@link DbxAppAuthRouterEffects} should perform automatic navigation on auth events.
 *
 * Routes can be added to the ignored set via {@link addIgnoredRoute} to prevent
 * auth effects from redirecting away from those routes (e.g., OAuth interaction pages).
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

  private readonly _isAuthRouterEffectsEnabled = new BehaviorSubject<boolean>(true);
  private readonly _ignoredRoutes = new BehaviorSubject<Set<SegueRefOrSegueRefRouterLink>>(new Set());

  /**
   * Observable of whether auth router effects are currently enabled.
   */
  readonly isAuthRouterEffectsEnabled$ = this._isAuthRouterEffectsEnabled.asObservable();

  /**
   * Observable of the set of route refs that are excluded from auth redirect effects.
   */
  readonly ignoredRoutes$ = this._ignoredRoutes.asObservable();

  /**
   * Observable that emits `true` when the current route is in the ignored set.
   *
   * Combines the ignored route refs with router transition events to re-evaluate
   * whenever the route or the ignored set changes.
   */
  readonly isCurrentRouteIgnoredByAuthEffects$: Observable<boolean> = combineLatest([this._ignoredRoutes, this.dbxRouterService.transitions$.pipe(startWith(undefined))]).pipe(
    map(([ignoredRefs]) => this._checkCurrentRouteIgnored(ignoredRefs)),
    distinctUntilChanged()
  );

  /**
   * Observable that emits `true` when auth router effects should be active for the current route.
   *
   * Combines the enabled flag and the ignored route check.
   */
  readonly shouldAuthEffectsRedirect$: Observable<boolean> = combineLatest([this.isAuthRouterEffectsEnabled$, this.isCurrentRouteIgnoredByAuthEffects$]).pipe(
    map(([enabled, ignored]) => enabled && !ignored),
    distinctUntilChanged()
  );

  ngOnDestroy(): void {
    this._isAuthRouterEffectsEnabled.complete();
    this._ignoredRoutes.complete();
  }

  get hasOnboardingState(): boolean {
    return Boolean(this.dbxAppAuthRoutes.onboardRef);
  }

  // MARK: Effects
  /**
   * Whether or not DbxAppAuthRouterEffects are enabled.
   *
   * @returns Whether auth router effects are currently enabled.
   */
  get isAuthRouterEffectsEnabled(): boolean {
    return this._isAuthRouterEffectsEnabled.value;
  }

  set isAuthRouterEffectsEnabled(enabled: boolean) {
    this._isAuthRouterEffectsEnabled.next(enabled);
  }

  // MARK: Ignored Routes
  /**
   * Adds a route to the ignored set. Auth effects will not redirect
   * when the user is on a route that matches any ignored route.
   *
   * Uses hierarchical matching — adding a parent route (e.g., `'/app/oauth'`)
   * will also ignore all child routes (e.g., `'/app/oauth/login'`).
   *
   * @param ref - The route ref to add to the ignored set.
   */
  addIgnoredRoute(ref: SegueRefOrSegueRefRouterLink): void {
    const current = this._ignoredRoutes.value;
    const next = new Set(current);
    next.add(ref);
    this._ignoredRoutes.next(next);
  }

  /**
   * Removes a route from the ignored set.
   *
   * @param ref - The route ref to remove from the ignored set.
   */
  removeIgnoredRoute(ref: SegueRefOrSegueRefRouterLink): void {
    const current = this._ignoredRoutes.value;
    const next = new Set(current);
    next.delete(ref);
    this._ignoredRoutes.next(next);
  }

  /**
   * Returns `true` if the current route matches any of the ignored routes.
   *
   * @returns Whether the current route is in the ignored set.
   */
  get isCurrentRouteIgnoredByAuthEffects(): boolean {
    return this._checkCurrentRouteIgnored(this._ignoredRoutes.value);
  }

  private _checkCurrentRouteIgnored(ignoredRefs: Set<SegueRefOrSegueRefRouterLink>): boolean {
    for (const ref of ignoredRefs) {
      if (this.dbxRouterService.isActive(ref)) {
        return true;
      }
    }

    return false;
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
