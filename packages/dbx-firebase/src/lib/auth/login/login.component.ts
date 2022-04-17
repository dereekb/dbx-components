import { DbxFirebaseLoginMode, FirebaseLoginMethodType } from './login';
import { Component, Input } from "@angular/core";
import { Maybe } from '@dereekb/util';

/**
 * Pre-configured login component that displays all configured login types.
 */
@Component({
  selector: 'dbx-firebase-login',
  template: `
    <ng-container *dbxInjectionContext dbxFirebaseLoginContext>
      <dbx-firebase-login-list [providerTypes]="providerTypes" [loginMode]="loginMode"></dbx-firebase-login-list>
    </ng-container>
  `,
  host: {
    'class': 'd-block dbx-firebase-login',
    '[class]': '{ "dbx-firebase-register": loginMode === "register" }'
  }
})
export class DbxFirebaseLoginComponent {

  @Input()
  loginMode: DbxFirebaseLoginMode = 'login';

  @Input()
  providerTypes: Maybe<FirebaseLoginMethodType[]>;

}
