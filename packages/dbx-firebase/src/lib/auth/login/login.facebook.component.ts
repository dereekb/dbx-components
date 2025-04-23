import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

@Component({
  selector: 'dbx-firebase-login-facebook',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.changeDetection,
  standalone: true
})
export class DbxFirebaseLoginFacebookComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'facebook';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithFacebook();
  }
}
