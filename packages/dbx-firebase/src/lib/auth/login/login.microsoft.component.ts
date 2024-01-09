import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from './login.button.component';

@Component({
  selector: 'dbx-firebase-login-microsoft',
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginMicrosoftComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'microsoft';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithMicrosoft();
  }
}
