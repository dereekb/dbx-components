import { FirebaseLoginMethodCategory, FirebaseLoginMethodType } from './login';
import { Component, input } from '@angular/core';
import { ArrayOrValue, type Maybe } from '@dereekb/util';
import { DbxFirebaseLoginComponent } from './login.component';

/**
 * Pre-configured register component that displays all configured login types and their registration components.
 */
@Component({
  selector: 'dbx-firebase-register',
  template: `
    <dbx-firebase-login loginMode="register" [providerTypes]="providerTypes()" [omitProviderTypes]="omitProviderTypes()" [providerCategories]="providerCategories()"></dbx-firebase-login>
  `,
  imports: [DbxFirebaseLoginComponent],
  standalone: true
})
export class DbxFirebaseRegisterComponent {
  readonly providerTypes = input<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>();
  readonly omitProviderTypes = input<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>();
  readonly providerCategories = input<Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>>();
}
