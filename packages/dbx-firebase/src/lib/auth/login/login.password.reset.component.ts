import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { from, tap } from 'rxjs';
import { type DbxFirebasePasswordResetFormValue, DbxFirebasePasswordResetFormComponent } from './login.password.reset.form.component';
import { DbxActionModule, DbxButtonComponent, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';

/**
 * Standalone component for completing a password reset.
 *
 * Reads an `oobCode` from input and presents a new password form.
 * On submit, calls {@link DbxFirebaseAuthService.completePasswordReset} to finalize the reset.
 */
@Component({
  selector: 'dbx-firebase-password-reset',
  templateUrl: './login.password.reset.component.html',
  imports: [DbxFirebasePasswordResetFormComponent, DbxActionModule, DbxButtonComponent, DbxErrorComponent, DbxActionFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebasePasswordResetComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  /**
   * The oobCode from the password reset email link.
   */
  readonly oobCode = input.required<string>();

  readonly resetCompleteSignal = signal(false);

  readonly handleResetAction: WorkUsingObservable<DbxFirebasePasswordResetFormValue> = (value: DbxFirebasePasswordResetFormValue) => {
    return from(
      this.dbxFirebaseAuthService.completePasswordReset({
        oobCode: this.oobCode(),
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
