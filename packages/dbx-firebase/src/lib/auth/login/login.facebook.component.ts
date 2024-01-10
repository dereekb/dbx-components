import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from './login.button.component';

@Component({
  selector: 'dbx-firebase-login-facebook',
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginFacebookComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'facebook';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithFacebook();
  }
}
