// MARK: Standalone Web App
/**
 * Whether or not the app is currently running as a standalone/installed web app (PWA).
 *
 * Detects both the standard `(display-mode: standalone)` media query and the iOS-specific
 * `navigator.standalone` flag (set for home-screen "Add to Home Screen" launches, where
 * Firebase's popup sign-in does not work). Safe to call during SSR (returns `false` when
 * `window` is unavailable).
 *
 * @returns True when the app is running in a standalone display context.
 *
 * @example
 * ```typescript
 * if (isStandaloneWebApp()) {
 *   // launched from the home screen
 * }
 * ```
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
