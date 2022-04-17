import { FirebaseLoginMethodType } from './login';
import { Component, Input } from "@angular/core";
import { Maybe } from '@dereekb/util';

/**
 * Pre-configured register component that displays all configured login types and their registration components.
 */
@Component({
  selector: 'dbx-firebase-register',
  template: `<dbx-firebase-login loginMode="register" [providerTypes]="providerTypes"></dbx-firebase-login>`
})
export class DbxFirebaseRegisterComponent {

  @Input()
  providerTypes: Maybe<FirebaseLoginMethodType[]>;

}
