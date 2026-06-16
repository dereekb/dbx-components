import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxOAuthConsentComponent } from '@dereekb/dbx-firebase/oidc';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';

/**
 * Container for the OIDC consent interaction. Reads `uid`, `client_name`, and
 * `scopes` from the query params, shows the requested scopes, and submits the
 * approve/deny decision back to the backend.
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
export class APP_CODE_PREFIXOAuthConsentComponent {}
