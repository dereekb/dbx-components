import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DbxFirebaseOidcEntryGrantListContainerComponent } from '@dereekb/dbx-firebase/oidc';

@Component({
  template: `
    <dbx-content-container>
      <h2>Apps with access to my account</h2>
      <p class="dbx-hint">Each row is an OIDC grant you've authorized. Revoking clears every access and refresh token tied to it.</p>
      <dbx-firebase-oidc-grant-list-container></dbx-firebase-oidc-grant-list-container>
    </dbx-content-container>
  `,
  standalone: true,
  imports: [DbxContentContainerDirective, DbxFirebaseOidcEntryGrantListContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DemoAppOidcGrantListPageComponent {}
