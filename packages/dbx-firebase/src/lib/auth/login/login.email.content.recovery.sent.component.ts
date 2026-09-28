import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxButtonComponent, DbxColorDirective, DbxIconTileComponent, DbxLinkComponent } from '@dereekb/dbx-web';
import { DbxFirebaseLoginEmailContentStore } from './login.email.content.store';

/**
 * Default "password reset email sent" view of the email login content.
 *
 * Confirms the address the reset email was sent to, and points users that did not receive it to their spam folder or,
 * when the app configures a password reset anchor, to entering a recovery code instead.
 *
 * Replace it through {@link DbxFirebaseLoginPasswordRecoveryViewsConfig.recoverySentView}.
 */
@Component({
  selector: 'dbx-firebase-login-email-content-recovery-sent',
  templateUrl: './login.email.content.recovery.sent.component.html',
  host: {
    class: 'dbx-firebase-login-email-content-recovery-sent d-block',
    role: 'status'
  },
  imports: [DbxButtonComponent, DbxColorDirective, DbxIconTileComponent, DbxLinkComponent]
})
export class DbxFirebaseLoginEmailContentRecoverySentComponent {
  readonly store = inject(DbxFirebaseLoginEmailContentStore);

  readonly recoveryEmailSentToSignal = toSignal(this.store.recoveryEmailSentTo$);
  readonly passwordResetAnchorSignal = toSignal(this.store.passwordResetAnchor$);

  returnToLogin() {
    this.store.returnToLogin();
  }
}
