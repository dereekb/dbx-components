import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE } from './login.button.component';

@Component({
  selector: 'dbx-firebase-login-github',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.imports,
  standalone: true,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.template
})
export class DbxFirebaseLoginGitHubComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'github';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithGithub();
  }
}
