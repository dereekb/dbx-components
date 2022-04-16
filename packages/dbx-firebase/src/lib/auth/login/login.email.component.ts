import { Component } from "@angular/core";
import { AbstractConfiguredDbxFirebaseLoginButtonDirective } from "./login.button.component";

@Component({
  templateUrl: './login.email.component.html'
})
export class DbxFirebaseLoginEmailComponent extends AbstractConfiguredDbxFirebaseLoginButtonDirective {

  readonly loginProvider = 'email';

  handleLogin(): Promise<any> {
    return Promise.resolve(undefined); //  this.dbxFirebaseAuthService.logInWithEmailAndPassword();
  }

}
