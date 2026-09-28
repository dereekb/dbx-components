import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { DbxActionErrorDirective, DbxActionModule, DbxButtonComponent, DbxErrorComponent, DbxLinkComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxFirebaseLoginEmailContentStore } from './login.email.content.store';
import { type DbxFirebaseEmailRecoveryFormValue, DbxFirebaseEmailRecoveryForgeFormComponent } from './login.email.recovery.forge.form.component';

/**
 * Default "request a password reset" view of the email login content.
 *
 * Asks for the account's email address and sends a password reset email to it. When the app configures a password
 * reset anchor, it also links users that already hold a recovery code to the reset page.
 *
 * Replace it through {@link DbxFirebaseLoginPasswordRecoveryViewsConfig.recoveryView}.
 */
@Component({
  selector: 'dbx-firebase-login-email-content-recovery',
  templateUrl: './login.email.content.recovery.component.html',
  host: {
    class: 'dbx-firebase-login-email-content-recovery d-block'
  },
  imports: [DbxActionModule, DbxActionErrorDirective, DbxActionFormDirective, DbxButtonComponent, DbxErrorComponent, DbxLinkComponent, DbxFormSourceDirective, DbxFirebaseEmailRecoveryForgeFormComponent]
})
export class DbxFirebaseLoginEmailContentRecoveryComponent {
  readonly store = inject(DbxFirebaseLoginEmailContentStore);

  readonly recoveryFormValueSignal = toSignal(this.store.recoveryFormValue$);
  readonly passwordResetAnchorSignal = toSignal(this.store.passwordResetAnchor$);

  readonly handleRecoveryAction: WorkUsingContext<DbxFirebaseEmailRecoveryFormValue> = (value, context) => {
    context.startWorkingWithPromise(this.store.sendPasswordReset(value));
  };

  readonly handleRecoverySuccess: DbxActionSuccessHandlerFunction = () => {
    this.store.markRecoverySent();
  };

  returnToLogin() {
    this.store.returnToLogin();
  }
}
