import { Component } from '@angular/core';
import { FacebookAuthProvider } from 'firebase/auth';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

/**
 * Login button component for Facebook OAuth authentication.
 */
@Component({
  selector: 'dbx-firebase-login-facebook',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template
})
export class DbxFirebaseLoginFacebookComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'facebook';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithDefaultFlow(new FacebookAuthProvider());
  }

  override handleLink() {
    return this.dbxFirebaseAuthService.linkWithDefaultFlow(new FacebookAuthProvider());
  }
}
