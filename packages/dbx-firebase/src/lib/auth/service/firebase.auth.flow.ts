import { InjectionToken } from '@angular/core';

/**
 * The auth flow used by {@link DbxFirebaseAuthService} when a sign-in/link/reauthenticate is performed via a "default flow" method.
 *
 * - `popup` uses Firebase's `signInWithPopup`/`linkWithPopup`/`reauthenticateWithPopup`.
 * - `redirect` uses Firebase's `signInWithRedirect`/`linkWithRedirect`/`reauthenticateWithRedirect` (completed on reload via `getRedirectResult`).
 * - `auto` uses `redirect` when running as a standalone PWA (see {@link isStandaloneWebApp}) and `popup` otherwise.
 *
 * `redirect` is required for iOS home-screen "standalone" web apps, where `signInWithPopup` never returns the credential.
 */
export type DbxFirebaseAuthFlow = 'popup' | 'redirect' | 'auto';

/**
 * A concrete {@link DbxFirebaseAuthFlow} with `auto` already resolved to `popup` or `redirect`.
 */
export type DbxFirebaseResolvedAuthFlow = 'popup' | 'redirect';

/**
 * The default {@link DbxFirebaseAuthFlow} used when none is configured.
 *
 * Defaults to `popup` to remain backward compatible with existing apps.
 */
export const DEFAULT_DBX_FIREBASE_AUTH_FLOW: DbxFirebaseAuthFlow = 'popup';

/**
 * Injection token carrying the configured {@link DbxFirebaseAuthFlow} for {@link DbxFirebaseAuthService}.
 *
 * Provided by `provideDbxFirebaseAuth()` when a flow is configured; the service falls back to
 * {@link DEFAULT_DBX_FIREBASE_AUTH_FLOW} when the token is absent.
 */
export const DBX_FIREBASE_AUTH_FLOW_TOKEN = new InjectionToken<DbxFirebaseAuthFlow>('DbxFirebaseAuthFlow');

/**
 * Whether or not the app is currently running as a standalone/installed web app (PWA).
 *
 * Detects both the standard `(display-mode: standalone)` media query and the iOS-specific
 * `navigator.standalone` flag (set for home-screen "Add to Home Screen" launches, where
 * Firebase's popup sign-in does not work). Safe to call during SSR (returns `false` when
 * `window` is unavailable).
 *
 * @returns True when the app is running in a standalone display context.
 */
export function isStandaloneWebApp(): boolean {
  let result = false;

  if (typeof window !== 'undefined') {
    const displayModeStandalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })?.standalone === true;
    result = displayModeStandalone || iosStandalone;
  }

  return result;
}

/**
 * Resolves a {@link DbxFirebaseAuthFlow} to a concrete {@link DbxFirebaseResolvedAuthFlow}.
 *
 * `auto` resolves to `redirect` when running as a standalone web app (see {@link isStandaloneWebApp}),
 * otherwise `popup`. `popup` and `redirect` are returned unchanged.
 *
 * @param flow - The configured auth flow.
 * @returns The resolved auth flow (`popup` or `redirect`).
 */
export function resolveDbxFirebaseAuthFlow(flow: DbxFirebaseAuthFlow): DbxFirebaseResolvedAuthFlow {
  let result: DbxFirebaseResolvedAuthFlow;

  if (flow === 'auto') {
    result = isStandaloneWebApp() ? 'redirect' : 'popup';
  } else {
    result = flow;
  }

  return result;
}
