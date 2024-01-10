import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE } from './login.button.component';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';

@Component({
  selector: 'dbx-firebase-login-email',
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE
})
export class DbxFirebaseLoginEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'email';

  handleLogin() {
    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, { loginMode: 'login', passwordConfig: this.dbxFirebaseAuthLoginService.getPasswordConfig() });
  }
}
