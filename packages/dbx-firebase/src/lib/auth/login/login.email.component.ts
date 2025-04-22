import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective, DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION } from './login.button.component';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';

@Component({
  selector: 'dbx-firebase-login-email',
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.template,
  changeDetection: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION.changeDetection,
  standalone: true
})
export class DbxFirebaseLoginEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'email';

  handleLogin() {
    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, { loginMode: 'login', passwordConfig: this.dbxFirebaseAuthLoginService.getPasswordConfig() });
  }
}
