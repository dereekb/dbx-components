import { Component, inject } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DbxFirebasePasswordResetComponent } from '@dereekb/dbx-firebase';
import { clean, dbxRouteParamReaderInstance, DbxRouterService } from '@dereekb/dbx-core';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Demo container for the password reset completion page.
 *
 * Reads the `oobCode` from the UIRouter route params and renders the password reset form.
 */
@Component({
  template: `
    <dbx-content-box>
      <h2>Reset Password</h2>
      <dbx-firebase-password-reset [oobCode]="oobCodeSignal()">
        @if (!oobCodeSignal()) {
          <p hint class="dbx-hint">Enter the reset code from your password reset email along with your new password.</p>
        }
        <div class="dbx-pt2">
          <div>Custom Content Example</div>
        </div>
        <div success class="dbx-pt2">
          <div>Success Content</div>
        </div>
        <div error class="dbx-pt2">
          <div>Error Content</div>
        </div>
      </dbx-firebase-password-reset>
    </dbx-content-box>
  `,
  imports: [DbxContentBoxDirective, DbxFirebasePasswordResetComponent]
})
export class DemoAuthResetPasswordComponent {
  private readonly dbxRouterService = inject(DbxRouterService);

  readonly oobCodeParamReader = clean(dbxRouteParamReaderInstance<string>(this.dbxRouterService, 'oobCode'));

  readonly oobCodeSignal = toSignal(this.oobCodeParamReader.value$);
}
