import { Component } from '@angular/core';
import { GoogleAuthProvider } from '@angular/fire/auth';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

/**
 * Login button component for Google OAuth authentication.
 */
@Component({
  selector: 'dbx-firebase-login-google',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.changeDetection,
  standalone: true
})
export class DbxFirebaseLoginGoogleComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'google';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithPopup(new GoogleAuthProvider());
  }

  override handleLink() {
    return this.dbxFirebaseAuthService.linkWithPopup(new GoogleAuthProvider());
  }
}
