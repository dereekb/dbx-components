import { Component } from "@angular/core";
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from "./login.button.component";

@Component({
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginAppleComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {

  readonly loginProvider = 'apple';

  handleLogin(): Promise<any> {
    return this.dbxFirebaseAuthService.logInWithApple();
  }

}
