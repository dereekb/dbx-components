import { HandleActionFunction, DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core'
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap } from 'rxjs';
import { Component, EventEmitter } from "@angular/core";
import { DbxFirebaseLoginContext } from "./login.context";
import { DbxFirebaseEmailFormValue } from './login.email.form.component';
import { DbxFirebaseLoginMode } from './login';
import { Inject } from '@angular/core';
import { firebaseAuthErrorToReadableError } from '../error';

export interface DbxFirebaseLoginEmailContentComponentConfig {
  mode: DbxFirebaseLoginMode;
}

@Component({
  templateUrl: './login.email.content.component.html'
})
export class DbxFirebaseLoginEmailContentComponent {

  readonly doneOrCancelled = new EventEmitter<boolean>();

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService, @Inject(DBX_INJECTION_COMPONENT_DATA) readonly config: DbxFirebaseLoginEmailContentComponentConfig) { }

  static openEmailLoginContext(dbxFirebaseLoginContext: DbxFirebaseLoginContext, config: DbxFirebaseLoginEmailContentComponentConfig): Promise<boolean> {
    return dbxFirebaseLoginContext.showContext({
      config: {
        componentClass: DbxFirebaseLoginEmailContentComponent,
        data: config
      },
      use: (instance) => firstValueFrom(instance.doneOrCancelled)
    });
  }

  get mode() {
    return this.config.mode;
  }

  get buttonText() {
    return this.config.mode === 'register' ? 'Register' : 'Log In';
  }

  onCancel() {
    this.doneOrCancelled.next(false);
  }

  readonly handleFormAction: HandleActionFunction = (value: DbxFirebaseEmailFormValue) => {
    let result;

    if (this.mode === 'register') {
      result = this.dbxFirebaseAuthService.registerWithEmailAndPassword(value.username, value.password);
    } else {
      result = this.dbxFirebaseAuthService.logInWithEmailAndPassword(value.username, value.password).catch((error) => {
        throw firebaseAuthErrorToReadableError(error);
      });
    }

    return from(result).pipe(
      tap(() => {
        this.doneOrCancelled.next(true);
      })
    );
  }

}
