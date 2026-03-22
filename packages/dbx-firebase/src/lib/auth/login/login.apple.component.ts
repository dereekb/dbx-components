import { Component } from '@angular/core';
import { OAuthProvider } from '@angular/fire/auth';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';

/**
 * Creates an Apple OAuthProvider configured with email and name scopes.
 *
 * @returns A configured {@link OAuthProvider} for Apple sign-in.
 */
function createAppleAuthProvider(): OAuthProvider {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  return provider;
}

/**
 * Login button component for Apple OAuth authentication.
 */
@Component({
  selector: 'dbx-firebase-login-apple',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.changeDetection,
  standalone: true
})
export class DbxFirebaseLoginAppleComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'apple';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithPopup(createAppleAuthProvider());
  }

  override handleLink() {
    return this.dbxFirebaseAuthService.linkWithPopup(createAppleAuthProvider());
  }
}
