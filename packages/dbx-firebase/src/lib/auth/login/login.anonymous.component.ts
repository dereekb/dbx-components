import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE } from './login.button.component';

@Component({
  selector: 'dbx-firebase-login-anonymous',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.changeDetection,
  standalone: true
})
export class DbxFirebaseLoginAnonymousComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'anonymous';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInAsAnonymous();
  }
}
