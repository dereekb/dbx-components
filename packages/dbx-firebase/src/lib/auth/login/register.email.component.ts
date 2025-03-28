import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective } from './login.button.component';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';
import { DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE } from './login.button.component';

@Component({
  imports: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.imports,
  template: DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE.template,
  standalone: true
})
export class DbxFirebaseRegisterEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'email';

  handleLogin() {
    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, { loginMode: 'register', passwordConfig: this.dbxFirebaseAuthLoginService.getPasswordConfig() });
  }
}
