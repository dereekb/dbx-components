import { type Observable } from 'rxjs';
import { type AuthRoleSet } from '@dereekb/util';
import { type AuthUserIdentifier, type AuthUserState } from '../auth.user';

/**
 * Abstract service that provides reactive access to the current authentication state, user roles, and lifecycle events.
 *
 * This is the primary abstraction for authentication in dbx-core. Concrete implementations
 * (e.g., Firebase-based auth) must provide all observable streams and the logout behavior.
 *
 * Components and services should inject this abstract class rather than a concrete implementation,
 * enabling the auth provider to be swapped without changing consumer code.
 *
 * @example
 * ```ts
 * @Component({ ... })
 * export class MyComponent {
 *   private readonly authService = inject(DbxAuthService);
 *
 *   readonly isLoggedIn$ = this.authService.isLoggedIn$;
 *   readonly roles$ = this.authService.authRoles$;
 *
 *   logout() {
 *     this.authService.logOut();
 *   }
 * }
 * ```
 *
 * @see {@link AuthUserState} for the possible user states.
 * @see {@link DbxAppAuthEffects} for how this service is bridged into the NgRx store.
 */
export abstract class DbxAuthService {
  /**
   * Whether or not the user is logged in.
   *
   * This will only emit once the authentication has been determined, preventing issues with premature decision making.
   *
   * A user is considered logged in even if there is an anonymous user. For more detailed info, consider using authUserState$.
   */
  abstract readonly isLoggedIn$: Observable<boolean>;

  /**
   * Whether or not the user has finished onboarding.
   *
   * This will only emit once the onboarding status has been determined, preventing issues with premature decision making.
   */
  abstract readonly isOnboarded$: Observable<boolean>;

  /**
   * Emits an event every time the user logs in.
   */
  abstract readonly onLogIn$: Observable<void>;

  /**
   * Emits an event every time the user logs out.
   */
  abstract readonly onLogOut$: Observable<void>;

  /**
   * Current state of the user.
   */
  abstract readonly authUserState$: Observable<AuthUserState>;

  /**
   * Role set for the current user.
   */
  abstract readonly authRoles$: Observable<AuthRoleSet>;

  /**
   * Identifier for the current user.
   */
  abstract readonly userIdentifier$: Observable<AuthUserIdentifier>;

  /**
   * Performs the logout action.
   */
  abstract logOut(): Promise<void>;
}
