import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { from, tap } from 'rxjs';
import { type DbxFirebasePasswordResetFormConfig, type DbxFirebasePasswordResetFormValue, DbxFirebasePasswordResetFormComponent } from './login.password.reset.form.component';
import { DbxActionErrorDirective, DbxActionModule, DbxButtonComponent, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { type FirebaseAuthOobCode, firebaseAuthErrorToReadableError } from '@dereekb/firebase';

/**
 * Standalone component for completing a password reset.
 *
 * Reads an optional `oobCode` from input and presents a new password form.
 * When no `oobCode` is supplied, the form additionally prompts the user to enter the reset code.
 * On submit, calls {@link DbxFirebaseAuthService.completePasswordReset} to finalize the reset.
 */
@Component({
  selector: 'dbx-firebase-password-reset',
  templateUrl: './login.password.reset.component.html',
  imports: [DbxFirebasePasswordResetFormComponent, DbxActionModule, DbxButtonComponent, DbxErrorComponent, DbxActionErrorDirective, DbxActionFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebasePasswordResetComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  /**
   * The oobCode from the password reset email link.
   *
   * When omitted, the form prompts the user to enter the reset code.
   */
  readonly oobCode = input<Maybe<FirebaseAuthOobCode>>();

  readonly resetCompleteSignal = signal(false);

  readonly formConfigSignal = computed<DbxFirebasePasswordResetFormConfig>(() => ({
    showOobCodeInput: !this.oobCode()
  }));

  readonly handleResetAction: WorkUsingObservable<DbxFirebasePasswordResetFormValue> = (value: DbxFirebasePasswordResetFormValue) => {
    const oobCode = this.oobCode() || value.oobCode;

    return from(
      this.dbxFirebaseAuthService.completePasswordReset({
        oobCode: oobCode as FirebaseAuthOobCode,
        newPassword: value.password
      })
    ).pipe(
      tap({
        next: () => this.resetCompleteSignal.set(true),
        error: (error) => {
          throw firebaseAuthErrorToReadableError(error);
        }
      })
    );
  };
}
