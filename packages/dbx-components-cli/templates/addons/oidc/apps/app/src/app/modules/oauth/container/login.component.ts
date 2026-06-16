import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxFirebaseOAuthLoginComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxFirebaseLoginComponent } from '@dereekb/dbx-firebase';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';

/**
 * Container for the OIDC login interaction.
 *
 * Projects the standard `<dbx-firebase-login>` UI into `<dbx-firebase-oauth-login>`,
 * which reads the `uid` interaction param and auto-submits the ID token on login.
 * Replace `<dbx-firebase-login>` with your app's own login view if you have one.
 */
@Component({
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-login>
        <dbx-firebase-login></dbx-firebase-login>
      </dbx-firebase-oauth-login>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxFirebaseOAuthLoginComponent, DbxFirebaseLoginComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class APP_CODE_PREFIXOAuthLoginComponent {}
