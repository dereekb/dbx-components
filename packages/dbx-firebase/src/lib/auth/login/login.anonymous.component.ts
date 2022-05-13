import { Component } from "@angular/core";
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from "./login.button.component";

@Component({
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginAnonymousComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {

  readonly loginProvider = 'anonymous';

  handleLogin(): Promise<any> {
    return this.dbxFirebaseAuthService.logInAsAnonymous();
  }

}
