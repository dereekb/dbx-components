import { FirebaseLoginMethodCategory, FirebaseLoginMethodType } from './login';
import { Component, Input } from '@angular/core';
import { ArrayOrValue, type Maybe } from '@dereekb/util';

/**
 * Pre-configured register component that displays all configured login types and their registration components.
 */
@Component({
  selector: 'dbx-firebase-register',
  template: `
    <dbx-firebase-login loginMode="register" [providerTypes]="providerTypes" [omitProviderTypes]="omitProviderTypes" [providerCategories]="providerCategories"></dbx-firebase-login>
  `
})
export class DbxFirebaseRegisterComponent {
  @Input()
  providerTypes: Maybe<ArrayOrValue<FirebaseLoginMethodType>>;

  @Input()
  omitProviderTypes: Maybe<ArrayOrValue<FirebaseLoginMethodType>>;

  @Input()
  providerCategories: Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>;
}
