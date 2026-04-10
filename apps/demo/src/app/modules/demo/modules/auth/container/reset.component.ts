import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DbxFirebasePasswordResetComponent } from '@dereekb/dbx-firebase';

/**
 * Demo container for the password reset completion page.
 *
 * Reads the `oobCode` from the UIRouter route params and renders the password reset form.
 */
@Component({
  template: `
    <dbx-content-box>
      <h2>Reset Password</h2>
      <dbx-firebase-password-reset [oobCode]="oobCode()"></dbx-firebase-password-reset>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxFirebasePasswordResetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAuthResetPasswordComponent {
  /**
   * Firebase out-of-band code from the reset email link, bound from UIRouter params.
   */
  readonly oobCode = input<string>('');
}
