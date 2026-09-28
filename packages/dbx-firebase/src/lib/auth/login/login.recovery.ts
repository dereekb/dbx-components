import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

/**
 * Replaces the default password recovery views shown by the email login content.
 *
 * A custom view injects the {@link DbxFirebaseLoginEmailContentStore} to read the entered address and the password
 * reset anchor, and to send the reset email or return to the login form. Leave `injector` unset on the configs so the
 * view resolves the store from the email login content that hosts it.
 */
export interface DbxFirebaseLoginPasswordRecoveryViewsConfig {
  /**
   * Replaces the "request a password reset" view.
   *
   * Defaults to {@link DbxFirebaseLoginEmailContentRecoveryComponent}.
   */
  readonly recoveryView?: Maybe<DbxInjectionComponentConfig>;
  /**
   * Replaces the "password reset email sent" view.
   *
   * Defaults to {@link DbxFirebaseLoginEmailContentRecoverySentComponent}.
   */
  readonly recoverySentView?: Maybe<DbxInjectionComponentConfig>;
}
