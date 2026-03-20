import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxOAuthConsentComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';

/**
 * Demo container component for the OIDC consent interaction.
 *
 * Receives the interaction UID, client name, and requested scopes from
 * query params (populated by the server redirect) and passes them to
 * the `DbxOAuthConsentComponent`.
 */
@Component({
  template: `
    <dbx-content-box>
      <dbx-firebase-oauth-consent></dbx-firebase-oauth-consent>
    </dbx-content-box>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxOAuthConsentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoOAuthConsentComponent {}
