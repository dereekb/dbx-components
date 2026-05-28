import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
        <div>Custom Content</div>
        <div success>Success Content</div>
        <div error>Error Content</div>
      </dbx-firebase-password-reset>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxFirebasePasswordResetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAuthResetPasswordComponent {
  private readonly dbxRouterService = inject(DbxRouterService);

  readonly oobCodeParamReader = clean(dbxRouteParamReaderInstance<string>(this.dbxRouterService, 'oobCode'));

  readonly oobCodeSignal = toSignal(this.oobCodeParamReader.value$);
}
