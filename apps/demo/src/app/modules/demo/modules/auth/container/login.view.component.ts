import { Component, computed, inject, signal } from '@angular/core';
import { type DbxFirebaseLoginMode, DbxFirebaseExternalConnectionService, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';
import {
  USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED_ERROR_CODE,
  USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

import { DbxLinkComponent, DbxTextColorDirective } from '@dereekb/dbx-web';

/**
 * What the login page says about each reason a provider sign-in was refused.
 *
 * Keyed on the server's allowlisted codes rather than on a message the server sent: the copy belongs
 * to the app, and a server message rendered verbatim in a browser is both an information leak and
 * untranslatable.
 *
 * The email-conflict case is the long one on purpose — it is the only refusal the user can actually
 * do something about, and what to do is not guessable. The demo will NOT adopt an existing account
 * off a third-party email, so the remedy is the connect flow, performed while signed in.
 */
export const DEMO_EXTERNAL_CONNECTION_SIGN_IN_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [USER_EXTERNAL_CONNECTION_SIGN_IN_EMAIL_CONFLICT_ERROR_CODE]: 'An account already exists for the email on that account. Recover access to that email, sign in with it, then connect the service from your settings page.',
  [USER_EXTERNAL_CONNECTION_EXTERNAL_ACCOUNT_IN_USE_ERROR_CODE]: 'That account is already connected to a different user.',
  [USER_EXTERNAL_CONNECTION_SIGN_IN_DENIED_ERROR_CODE]: 'That account is not allowed to sign in here.',
  [USER_EXTERNAL_CONNECTION_SIGN_IN_NOT_ENABLED_ERROR_CODE]: 'That service cannot be used to sign in.',
  [USER_EXTERNAL_CONNECTION_SIGN_IN_USER_MISSING_ERROR_CODE]: 'The user connected to that account no longer exists.',
  [USER_EXTERNAL_CONNECTION_SIGN_IN_IDENTITY_UNAVAILABLE_ERROR_CODE]: 'We could not read that account. Please try again.'
};

/**
 * Fallback for a reason code this app has no copy for, so a new server code degrades to a sentence
 * rather than to silence.
 */
export const DEMO_EXTERNAL_CONNECTION_SIGN_IN_ERROR_FALLBACK_MESSAGE = 'That sign-in could not be completed. Please try again.';

@Component({
  selector: 'app-login-view',
  templateUrl: './login.view.component.html',
  imports: [DbxFirebaseLoginComponent, DbxLinkComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent, DbxTextColorDirective]
})
export class DemoAuthLoginViewComponent {
  private readonly _externalConnectionService = inject(DbxFirebaseExternalConnectionService);

  readonly mode = signal<DbxFirebaseLoginMode>('login');

  /**
   * The refusal the app initializer read off the redirect, as copy this page can render.
   *
   * Read from the service rather than from the URL, because the redirect is consumed during app
   * initialization — long before this view exists.
   */
  readonly signInErrorMessage = computed<Maybe<string>>(() => {
    const code = this._externalConnectionService.signInErrorCode();
    return code == null ? undefined : (DEMO_EXTERNAL_CONNECTION_SIGN_IN_ERROR_MESSAGES[code] ?? DEMO_EXTERNAL_CONNECTION_SIGN_IN_ERROR_FALLBACK_MESSAGE);
  });
}
