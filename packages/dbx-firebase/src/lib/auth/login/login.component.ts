import { DbxFirebaseLoginMode, FirebaseLoginMethodCategory, FirebaseLoginMethodType } from './login';
import { Component, Input } from '@angular/core';
import { ArrayOrValue, type Maybe } from '@dereekb/util';

/**
 * Pre-configured login component that displays all configured login types.
 */
@Component({
  selector: 'dbx-firebase-login',
  template: `
    <ng-container *dbxInjectionContext dbxFirebaseLoginContext>
      <dbx-firebase-login-list [providerTypes]="providerTypes" [omitProviderTypes]="omitProviderTypes" [providerCategories]="providerCategories" [loginMode]="loginMode"></dbx-firebase-login-list>
    </ng-container>
  `,
  host: {
    class: 'd-block dbx-firebase-login',
    '[class]': '{ "dbx-firebase-register": loginMode === "register" }'
  }
})
export class DbxFirebaseLoginComponent {
  @Input()
  loginMode: DbxFirebaseLoginMode = 'login';

  @Input()
  providerTypes: Maybe<ArrayOrValue<FirebaseLoginMethodType>>;

  @Input()
  omitProviderTypes: Maybe<ArrayOrValue<FirebaseLoginMethodType>>;

  @Input()
  providerCategories: Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>;
}
