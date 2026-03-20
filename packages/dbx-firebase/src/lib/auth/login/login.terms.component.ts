import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';

import { Component, inject } from '@angular/core';
import { DbxFirebaseAuthLoginService } from './login.service';

/**
 * Renders the configured terms of service component via dynamic injection from the login service.
 */
@Component({
  selector: 'dbx-firebase-login-terms',
  template: `
    <dbx-injection [config]="config"></dbx-injection>
  `,
  host: {
    class: 'dbx-firebase-login-terms d-block'
  },
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxFirebaseLoginTermsComponent {
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);

  readonly config: DbxInjectionComponentConfig = {
    componentClass: this.dbxFirebaseAuthLoginService.loginTermsComponentClass
  };
}
