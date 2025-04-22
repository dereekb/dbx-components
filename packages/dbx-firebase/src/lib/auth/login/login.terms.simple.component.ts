import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component, inject } from '@angular/core';
import { DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG } from './login.terms';
import { DbxLinkComponent } from '@dereekb/dbx-web';

@Component({
  template: `
    <div class="dbx-firebase-login-terms-view">
      <dbx-link [anchor]="tosAnchor">Terms</dbx-link>
      <span class="dbx-link-spacer"></span>
      <dbx-link [anchor]="privacyAnchor">Privacy</dbx-link>
    </div>
  `,
  standalone: true,
  imports: [DbxLinkComponent]
})
export class DbxFirebaseLoginTermsSimpleComponent {
  readonly dbxFirebaseLoginTermsConfig = inject(DBX_FIREBASE_LOGIN_TERMS_OF_SERVICE_URLS_CONFIG);

  readonly tosAnchor: ClickableAnchor = {
    url: this.dbxFirebaseLoginTermsConfig.tosUrl,
    target: '_blank'
  };

  readonly privacyAnchor: ClickableAnchor = {
    url: this.dbxFirebaseLoginTermsConfig.privacyUrl,
    target: '_blank'
  };
}
