import { ChangeDetectionStrategy, Component } from '@angular/core';
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
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-consent>
        <app-login-view></app-login-view>
      </dbx-firebase-oauth-consent>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxOAuthConsentComponent, DemoAuthLoginViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoOAuthConsentComponent {}
