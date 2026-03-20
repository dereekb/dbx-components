import { type SegueRefOrSegueRefRouterLink } from '../../router/segue';

/**
 * Abstract configuration class that defines the key authentication-related routes for an application.
 *
 * Provide a concrete instance of this class via {@link provideDbxAppAuthRouter} to configure
 * where the auth router service navigates during authentication lifecycle events (login, logout, onboarding).
 *
 * @example
 * ```ts
 * const authRoutes: DbxAppAuthRoutes = {
 *   loginRef: '/auth/login',
 *   loggedOutRef: '/auth/logged-out',
 *   onboardRef: '/onboard',
 *   appRef: '/app'
 * };
 * ```
 *
 * @see {@link DbxAppAuthRouterService} for the service that uses these routes for navigation.
 * @see {@link provideDbxAppAuthRouter} for registering this configuration.
 */
export abstract class DbxAppAuthRoutes {
  /**
   * Route reference for the login page. Users are redirected here when authentication is required.
   */
  abstract readonly loginRef: SegueRefOrSegueRefRouterLink;
  /**
   * Optional route reference for the logged-out page. Falls back to {@link loginRef} if not provided.
   */
  abstract readonly loggedOutRef?: SegueRefOrSegueRefRouterLink;
  /**
   * Optional route reference for the onboarding/setup page. Falls back to {@link appRef} if not provided.
   */
  abstract readonly onboardRef?: SegueRefOrSegueRefRouterLink;
  /**
   * Route reference for the main application page. Users are redirected here after successful authentication.
   */
  abstract readonly appRef: SegueRefOrSegueRefRouterLink;
}
