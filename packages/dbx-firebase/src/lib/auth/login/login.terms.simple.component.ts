import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component } from "@angular/core";
import { DbxFirebaseLoginTermsConfig } from './login.terms';

@Component({
  template: `
  <div class="dbx-firebase-login-terms-view">
    <dbx-link [anchor]="tosAnchor">Terms</dbx-link>
    <span class="dbx-link-spacer"></span>
    <dbx-link [anchor]="privacyAnchor">Privacy</dbx-link>
  </div>
  `
})
export class DbxFirebaseLoginTermsSimpleComponent {

  readonly tosAnchor: ClickableAnchor = {
    url: this.dbxFirebaseLoginTermsConfig.tosUrl,
    target: '_blank'
  };

  readonly privacyAnchor: ClickableAnchor = {
    url: this.dbxFirebaseLoginTermsConfig.privacyUrl,
    target: '_blank'
  };

  constructor(readonly dbxFirebaseLoginTermsConfig: DbxFirebaseLoginTermsConfig) { }

}
