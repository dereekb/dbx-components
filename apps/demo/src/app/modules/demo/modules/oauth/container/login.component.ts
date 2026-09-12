import { Component } from '@angular/core';
import { DbxFirebaseOAuthLoginComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DemoAuthLoginViewComponent } from '../../auth/container/login.view.component';

/**
 * Demo container component for the OIDC login interaction.
 *
 * Projects the app's `<app-login-view>` into the OAuth login component
 * to replace the default Firebase login UI.
 */
@Component({
  // A selector of its own: the login and consent containers have templates of the same shape, so left
  // selector-less they hash to the same component ID and Angular warns NG0912 on every OIDC interaction.
  selector: 'app-oauth-login',
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-login>
        <app-login-view></app-login-view>
      </dbx-firebase-oauth-login>
    </dbx-content-box>
  `,
  imports: [DbxContentBoxDirective, DbxFirebaseOAuthLoginComponent, DemoAuthLoginViewComponent]
})
export class DemoOAuthLoginComponent {}
