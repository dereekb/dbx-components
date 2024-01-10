import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from './login.button.component';

@Component({
  selector: 'dbx-firebase-login-google',
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginGoogleComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'google';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithGoogle();
  }
}
