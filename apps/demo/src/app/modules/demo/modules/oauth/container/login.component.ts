import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxFirebaseOAuthLoginComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DemoAuthLoginViewComponent } from '../../auth/container/login.view.component';

/**
 * Demo container component for the OIDC login interaction.
 *
 * Projects the app's `<demo-login-view>` into the OAuth login component
 * to replace the default Firebase login UI.
 */
@Component({
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-login>
        <demo-login-view></demo-login-view>
      </dbx-firebase-oauth-login>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxFirebaseOAuthLoginComponent, DemoAuthLoginViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoOAuthLoginComponent {}
