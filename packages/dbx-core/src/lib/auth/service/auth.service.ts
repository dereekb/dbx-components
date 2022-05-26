import { Observable } from 'rxjs';
import { AuthRoleSet } from '@dereekb/util';
import { AuthUserIdentifier, AuthUserState } from '../auth.user';

/**
 * Client auth service used to retrieve info about the current state of client authentication and client roles they may have.
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
