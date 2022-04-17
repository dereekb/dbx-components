import { Component } from "@angular/core";
import { AbstractConfiguredDbxFirebaseLoginButtonDirective } from "./login.button.component";
import { DbxFirebaseLoginEmailContentComponent } from "./login.email.content.component";

@Component({
  templateUrl: './register.email.component.html'
})
export class DbxFirebaseRegisterEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {

  readonly loginProvider = 'email';

  handleLogin(): Promise<any> {
    return DbxFirebaseLoginEmailContentComponent.openEmailLoginContext(this.dbxFirebaseLoginContext, { mode: 'register' });
  }

}
