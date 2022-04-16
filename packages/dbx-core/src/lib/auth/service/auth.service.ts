import { Observable } from 'rxjs';
import { AuthRoleSet } from '../auth.role';
import { AuthUserState } from '../auth.state';

/**
 * Client auth service used to retrieve info about the current state of client authentication and client roles they may have.
 */
export abstract class DbxAuthService {

  /**
   * Whether or not the client is logged in. 
   * 
   * This will only emit once the authentication has been determined, preventing issues with premature decision making.
   * 
   * A user is considered logged in even if there is an anonymous user. For more detailed info, consider using authUserState$.
   */
  abstract readonly isLoggedIn$: Observable<boolean>;

  /**
   * Emits an event every time the user was signed in but signs out.
   */
  abstract readonly onLogout$: Observable<void>;

  /**
   * Current state of the user.
   */
  abstract readonly authUserState$: Observable<AuthUserState>;

  /**
   * Role set for the current user.
   */
  abstract readonly authRoles$: Observable<AuthRoleSet>;

}
