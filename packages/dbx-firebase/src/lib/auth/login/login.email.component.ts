import { Component } from "@angular/core";
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from "./login.button.component";
import { DbxFirebaseLoginEmailContentComponent } from "./login.email.content.component";

@Component({
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {

  readonly loginProvider = 'email';

  handleLogin(): Promise<any> {
    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, { loginMode: 'login', passwordConfig: this.dbxFirebaseAuthLoginService.getPasswordConfig() });
  }

}
