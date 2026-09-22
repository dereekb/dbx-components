import { type EmailAddress, type Maybe } from '@dereekb/util';

/**
 * Default query parameter key the prefill's email address is read from.
 */
export const DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_EMAIL_PARAM = 'email';

/**
 * Default query parameter key the prefill's password is read from.
 */
export const DEFAULT_DBX_FIREBASE_LOGIN_PREFILL_PASSWORD_PARAM = 'password';

/**
 * Values used to pre-populate a login form the first time it is shown.
 *
 * Read off the current route by {@link DbxFirebaseLoginPrefillDirective}. An invite email, for instance, can link to
 * the login page with the invited address and its temporary password attached so the recipient is never asked to
 * copy a one-time password out of the email body by hand.
 *
 * Both values are optional because the route is their source and may carry either one alone.
 */
export interface DbxFirebaseLoginPrefill {
  /**
   * The email address to pre-populate.
   */
  readonly email?: Maybe<EmailAddress>;
  /**
   * The password to pre-populate.
   */
  readonly password?: Maybe<string>;
}
