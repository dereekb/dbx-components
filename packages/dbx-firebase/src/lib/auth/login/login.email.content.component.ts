import { DbxFirebaseEmailRecoveryFormValue } from './login.email.recovery.form.component';
import { DBX_INJECTION_COMPONENT_DATA, ClickableAnchor, DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { WorkUsingObservable, WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap } from 'rxjs';
import { Component, EventEmitter, inject, signal, computed, Signal } from '@angular/core';
import { DbxFirebaseLoginContext } from './login.context';
import { DbxFirebaseEmailFormValue, DbxFirebaseEmailFormConfig } from './login.email.form.component';
import { DbxFirebaseLoginMode } from './login';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { NgIf, NgSwitch, NgSwitchCase, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { DbxFirebaseEmailFormComponent } from './login.email.form.component';
import { DbxFirebaseEmailRecoveryFormComponent } from './login.email.recovery.form.component';

export interface DbxFirebaseLoginEmailContentComponentConfig extends DbxFirebaseEmailFormConfig {
  readonly loginMode: DbxFirebaseLoginMode;
}

export type DbxFirebaseLoginEmailContentMode = 'login' | 'recover' | 'recoversent';

@Component({
  templateUrl: './login.email.content.component.html',
  standalone: true,
  imports: [NgIf, NgSwitch, NgSwitchCase, NgTemplateOutlet, MatButtonModule, DbxActionModule, DbxButtonModule, DbxFirebaseEmailFormComponent, DbxFirebaseEmailRecoveryFormComponent]
})
export class DbxFirebaseLoginEmailContentComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly config = inject<DbxFirebaseLoginEmailContentComponentConfig>(DBX_INJECTION_COMPONENT_DATA);

  readonly formConfig: DbxFirebaseEmailFormConfig = {
    loginMode: this.config.loginMode,
    passwordConfig: this.config.passwordConfig
  };

  private readonly _emailFormValueSignal = signal<Maybe<DbxFirebaseEmailFormValue>>(undefined);
  private readonly _recoveryFormValueSignal = signal<Maybe<DbxFirebaseEmailRecoveryFormValue>>(undefined);
  private readonly _emailModeSignal = signal<DbxFirebaseLoginEmailContentMode>('login');

  readonly emailFormValueSignal = this._emailFormValueSignal();
  readonly recoveryFormValueSignal = this._recoveryFormValueSignal();
  readonly emailModeSignal = this._emailModeSignal();

  // Keep these for backward compatibility and template usage
  get emailFormValue(): Maybe<DbxFirebaseEmailFormValue> {
    return this._emailFormValueSignal();
  }

  set emailFormValue(value: Maybe<DbxFirebaseEmailFormValue>) {
    this._emailFormValueSignal.set(value);
  }

  get recoveryFormValue(): Maybe<DbxFirebaseEmailRecoveryFormValue> {
    return this._recoveryFormValueSignal();
  }

  set recoveryFormValue(value: Maybe<DbxFirebaseEmailRecoveryFormValue>) {
    this._recoveryFormValueSignal.set(value);
  }

  // No longer needed since we're using signals directly in the template

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
    this._emailModeSignal.set('recover');
  }

  readonly handleRecoveryAction: WorkUsingContext<DbxFirebaseEmailRecoveryFormValue> = (value: DbxFirebaseEmailRecoveryFormValue, context) => {
    this.recoveryFormValue = value;
    this.emailFormValue = { username: value.email, password: '' };
    context.startWorkingWithPromise(this.dbxFirebaseAuthService.sendPasswordResetEmail(value.email));
  };

  // MARK: Recovering
  readonly handleRecoverySuccess: DbxActionSuccessHandlerFunction = (x) => {
    this._emailModeSignal.set('recoversent');
  };

  clickedRecoveryAcknowledged() {
    this._emailModeSignal.set('login');
  }

  // MARK: Cancel
  onCancel() {
    this.doneOrCancelled.next(false);
  }

  onCancelReset() {
    this.doneOrCancelled.next(false);
  }
}
