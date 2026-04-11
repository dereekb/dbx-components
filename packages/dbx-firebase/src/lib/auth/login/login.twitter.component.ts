import { Component } from '@angular/core';
import { TwitterAuthProvider } from 'firebase/auth';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

/**
 * Login button component for X (formerly Twitter) OAuth authentication.
 */
@Component({
  selector: 'dbx-firebase-login-twitter',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.changeDetection,
  standalone: true
})
export class DbxFirebaseLoginTwitterComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'twitter';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithPopup(new TwitterAuthProvider());
  }

  override handleLink() {
    return this.dbxFirebaseAuthService.linkWithPopup(new TwitterAuthProvider());
  }
}
