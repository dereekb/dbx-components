import { Component } from '@angular/core';
import { AbstractConfiguredDbxFirebaseLoginButtonDirective } from './login.button.component';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';

@Component({
  templateUrl: './register.email.component.html'
})
export class DbxFirebaseRegisterEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {
  readonly loginProvider = 'email';

  handleLogin() {
    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, { loginMode: 'register', passwordConfig: this.dbxFirebaseAuthLoginService.getPasswordConfig() });
  }
}
