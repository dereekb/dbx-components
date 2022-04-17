import { DbxFirebaseEmailRecoveryFormValue } from './login.email.recovery.form.component';
import { HandleActionFunction, DBX_INJECTION_COMPONENT_DATA, ClickableAnchor } from '@dereekb/dbx-core'
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap, BehaviorSubject } from 'rxjs';
import { Component, EventEmitter, OnDestroy } from "@angular/core";
import { DbxFirebaseLoginContext } from "./login.context";
import { DbxFirebaseEmailFormValue } from './login.email.form.component';
import { DbxFirebaseLoginMode } from './login';
import { Inject } from '@angular/core';
import { firebaseAuthErrorToReadableError } from '../error';
import { Maybe } from '@dereekb/util';

export interface DbxFirebaseLoginEmailContentComponentConfig {
  mode: DbxFirebaseLoginMode;
}

export type DbxFirebaseLoginEmailContentMode = 'login' | 'recover' | 'recovering';

@Component({
  templateUrl: './login.email.content.component.html'
})
export class DbxFirebaseLoginEmailContentComponent implements OnDestroy {

  emailFormValue: Maybe<DbxFirebaseEmailRecoveryFormValue>;

  private _emailMode = new BehaviorSubject<DbxFirebaseLoginEmailContentMode>('login');
  readonly emailMode$ = this._emailMode.asObservable();

  readonly forgotAnchor: ClickableAnchor = {
    onClick: () => {
      this.openRecovery();
    }
  }

  readonly doneOrCancelled = new EventEmitter<boolean>();

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService, @Inject(DBX_INJECTION_COMPONENT_DATA) readonly config: DbxFirebaseLoginEmailContentComponentConfig) { }

  ngOnDestroy(): void {
    this._emailMode.complete();
  }

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
  readonly handleLoginAction: HandleActionFunction = (value: DbxFirebaseEmailFormValue) => {
    this.emailFormValue = { email: value.username };    // cache value for recovery

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

  // MARK: Recovery
  openRecovery() {
    this._emailMode.next('recover');
  }

  readonly handleRecoveryAction: HandleActionFunction = (value: DbxFirebaseEmailRecoveryFormValue) => {
    let result = this.dbxFirebaseAuthService.sendPasswordResetEmail(value.email);

    return from(result).pipe(
      tap(() => {

      })
    );
  }

  onCancel() {
    this.doneOrCancelled.next(false);
  }

  onCancelReset() {
    this.doneOrCancelled.next(false);
  }

}
