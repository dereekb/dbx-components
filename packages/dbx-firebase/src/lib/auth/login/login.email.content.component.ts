import { DbxFirebaseEmailRecoveryFormValue } from './login.email.recovery.form.component';
import { HandleActionFunction, DBX_INJECTION_COMPONENT_DATA, ClickableAnchor } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap, BehaviorSubject } from 'rxjs';
import { Component, EventEmitter, OnDestroy, Inject } from '@angular/core';
import { DbxFirebaseLoginContext } from './login.context';
import { DbxFirebaseEmailFormValue, DbxFirebaseEmailFormConfig } from './login.email.form.component';
import { DbxFirebaseLoginMode } from './login';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';

export interface DbxFirebaseLoginEmailContentComponentConfig extends DbxFirebaseEmailFormConfig {
  loginMode: DbxFirebaseLoginMode;
}

export type DbxFirebaseLoginEmailContentMode = 'login' | 'recover' | 'recovering';

@Component({
  templateUrl: './login.email.content.component.html'
})
export class DbxFirebaseLoginEmailContentComponent implements OnDestroy {
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

  constructor(readonly dbxFirebaseAuthService: DbxFirebaseAuthService, @Inject(DBX_INJECTION_COMPONENT_DATA) readonly config: DbxFirebaseLoginEmailContentComponentConfig) {}

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

  readonly handleLoginAction: HandleActionFunction<DbxFirebaseEmailFormValue> = (value: DbxFirebaseEmailFormValue) => {
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

  readonly handleRecoveryAction: HandleActionFunction<DbxFirebaseEmailRecoveryFormValue> = (value) => {
    this.recoveryFormValue = value;
    this.emailFormValue = { username: value.email, password: '' };

    const result = this.dbxFirebaseAuthService.sendPasswordResetEmail(value.email);

    return from(result).pipe(
      tap(() => {
        this.onRecoveringSuccess();
      })
    );
  };

  // MARK: Recovering
  onRecoveringSuccess() {
    // optionally override in parent
  }

  // MARK: Cancel
  onCancel() {
    this.doneOrCancelled.next(false);
  }

  onCancelReset() {
    this.doneOrCancelled.next(false);
  }
}
