import { Component } from "@angular/core";
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from "./login.button.component";

@Component({
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginGitHubComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {

  readonly loginProvider = 'github';

  handleLogin() {
    return this.dbxFirebaseAuthService.logInWithGithub();
  }

}
