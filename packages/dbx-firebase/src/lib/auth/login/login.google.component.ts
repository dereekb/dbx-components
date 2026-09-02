import { Component } from '@angular/core';
import { GoogleAuthProvider } from 'firebase/auth';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

/**
 * Login button component for Google OAuth authentication.
 */
@Component({
  selector: 'dbx-firebase-login-google',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.changeDetection
})
export class DbxFirebaseLoginGoogleComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'google';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithDefaultFlow(new GoogleAuthProvider());
  }

  override handleLink() {
    return this.dbxFirebaseAuthService.linkWithDefaultFlow(new GoogleAuthProvider());
  }
}
