import { Component } from '@angular/core';
import { DbxOAuthConsentComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DemoAuthLoginViewComponent } from '../../auth/container/login.view.component';

/**
 * Demo container component for the OIDC consent interaction.
 *
 * Receives the interaction UID, client name, and requested scopes from
 * query params (populated by the server redirect) and passes them to
 * the `DbxOAuthConsentComponent`. Projects the app's `<app-login-view>`
 * so it renders if the user is not signed in when reaching the consent step.
 */
@Component({
  // A selector of its own: the login and consent containers have templates of the same shape, so left
  // selector-less they hash to the same component ID and Angular warns NG0912 on every OIDC interaction.
  selector: 'app-oauth-consent',
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-consent>
        <app-login-view></app-login-view>
      </dbx-firebase-oauth-consent>
    </dbx-content-box>
  `,
  imports: [DbxContentBoxDirective, DbxOAuthConsentComponent, DemoAuthLoginViewComponent]
})
export class DemoOAuthConsentComponent {}
