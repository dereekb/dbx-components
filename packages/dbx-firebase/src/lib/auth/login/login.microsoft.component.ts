import { Component } from '@angular/core';
import { OAuthProvider } from 'firebase/auth';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

/**
 * Login button component for Microsoft OAuth authentication.
 */
@Component({
  selector: 'dbx-firebase-login-microsoft',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template
})
export class DbxFirebaseLoginMicrosoftComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'microsoft';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithDefaultFlow(new OAuthProvider('microsoft.com'));
  }

  override handleLink() {
    return this.dbxFirebaseAuthService.linkWithDefaultFlow(new OAuthProvider('microsoft.com'));
  }
}
