import { DbxFirebaseEmailRecoveryFormValue } from './login.email.recovery.form.component';
import { DBX_INJECTION_COMPONENT_DATA, ClickableAnchor, DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { WorkUsingObservable, WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap, BehaviorSubject } from 'rxjs';
import { Component, EventEmitter, OnDestroy, Inject, inject } from '@angular/core';
import { DbxFirebaseLoginContext } from './login.context';
import { DbxFirebaseEmailFormValue, DbxFirebaseEmailFormConfig } from './login.email.form.component';
import { DbxFirebaseLoginMode } from './login';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

export interface DbxFirebaseLoginEmailContentComponentConfig extends DbxFirebaseEmailFormConfig {
  loginMode: DbxFirebaseLoginMode;
}

export type DbxFirebaseLoginEmailContentMode = 'login' | 'recover' | 'recoversent';

@Component({
  templateUrl: './login.email.content.component.html'
})
export class DbxFirebaseLoginEmailContentComponent implements OnDestroy {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly config = inject<DbxFirebaseLoginEmailContentComponentConfig>(DBX_INJECTION_COMPONENT_DATA);

  readonly formConfig: DbxFirebaseEmailFormConfig = {
    loginMode: this.config.loginMode,
    passwordConfig: this.config.passwordConfig
  };

  emailFormValue: Maybe<DbxFirebaseEmailFormValue>;
  recoveryFormValue: Maybe<DbxFirebaseEmailRecoveryFormValue>;

  private _emailMode = new BehaviorSubject<DbxFirebaseLoginEmailContentMode>('login');
  readonly emailMode$ = this._emailMode.asObservable();

  readonly forgotAnchor: ClickableAnchor = {
    onClick: () => {
      this.openRecovery();
    }
  };

  readonly doneOrCancelled = new EventEmitter<boolean>();

  static openEmailLoginContext(dbxFirebaseLoginContext: DbxFirebaseLoginContext, config: DbxFirebaseLoginEmailContentComponentConfig): Promise<boolean> {
    return dbxFirebaseLoginContext.showContext({
      config: {
        componentClass: DbxFirebaseLoginEmailContentComponent,
        data: config
      },
      use: (instance) => firstValueFrom(instance.doneOrCancelled)
    });
  }

  ngOnDestroy(): void {
    this._emailMode.complete();
  }

  get loginMode() {
    return this.config.loginMode;
  }

  get isLoginMode() {
    return this.loginMode === 'login';
  }

  get isRegisterMode() {
    return this.loginMode === 'register';
  }

  get buttonText() {
    return this.config.loginMode === 'register' ? 'Register' : 'Log In';
  }

  readonly handleLoginAction: WorkUsingObservable<DbxFirebaseEmailFormValue> = (value: DbxFirebaseEmailFormValue) => {
    this.emailFormValue = value;
    this.recoveryFormValue = { email: value.username }; // cache value for recovery

    let result;

    if (this.loginMode === 'register') {
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
  };

  // MARK: Recovery
  openRecovery() {
    this._emailMode.next('recover');
  }

  readonly handleRecoveryAction: WorkUsingContext<DbxFirebaseEmailRecoveryFormValue> = (value: DbxFirebaseEmailRecoveryFormValue, context) => {
    this.recoveryFormValue = value;
    this.emailFormValue = { username: value.email, password: '' };
    context.startWorkingWithPromise(this.dbxFirebaseAuthService.sendPasswordResetEmail(value.email));
  };

  // MARK: Recovering
  readonly handleRecoverySuccess: DbxActionSuccessHandlerFunction = (x) => {
    this._emailMode.next('recoversent');
  };

  clickedRecoveryAcknowledged() {
    this._emailMode.next('login');
  }

  // MARK: Cancel
  onCancel() {
    this.doneOrCancelled.next(false);
  }

  onCancelReset() {
    this.doneOrCancelled.next(false);
  }
}
