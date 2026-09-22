import { type DbxFirebaseEmailRecoveryFormValue, DbxFirebaseEmailRecoveryForgeFormComponent } from './login.email.recovery.forge.form.component';
import { DBX_INJECTION_COMPONENT_DATA, type ClickableAnchor, type DbxActionSuccessHandlerFunction } from '@dereekb/dbx-core';
import { type WorkUsingObservable, type WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap } from 'rxjs';
import { Component, EventEmitter, inject, signal } from '@angular/core';
import { type DbxFirebaseLoginContext } from './login.context';
import { type DbxFirebaseEmailFormValue, type DbxFirebaseEmailFormConfig, DbxFirebaseEmailForgeFormComponent } from './login.email.forge.form.component';
import { type DbxFirebaseLoginMode } from './login';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { NgTemplateOutlet } from '@angular/common';
import { DbxActionErrorDirective, DbxActionModule, DbxAnchorComponent, DbxLinkComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxContentPitDirective, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';

/**
 * Configuration for the email login content component, specifying mode and password rules.
 */
export interface DbxFirebaseLoginEmailContentComponentConfig extends DbxFirebaseEmailFormConfig {
  readonly loginMode: DbxFirebaseLoginMode;
  /**
   * Anchor to the app's password reset page. When set, the recovery view offers an "Already have a recovery code?" link to it,
   * and acknowledging a sent recovery email navigates there instead of returning to the login form.
   */
  readonly passwordResetAnchor?: Maybe<ClickableAnchor>;
  /**
   * Values to pre-populate the login form with, from a {@link DbxFirebaseLoginPrefill}.
   *
   * The username also seeds the recovery form, so a user that arrives with their address filled in and then follows
   * "Forgot Password?" is not asked for it a second time.
   */
  readonly defaultValue?: Maybe<DbxFirebaseEmailFormValue>;
}

/**
 * UI state of the email login content: login form, password recovery form, or recovery sent confirmation.
 */
export type DbxFirebaseLoginEmailContentMode = 'login' | 'recover' | 'recoversent';

/**
 * Full email login/registration flow component with login form, password recovery, and recovery confirmation states.
 *
 * Opened via the {@link DbxFirebaseLoginContext} injection context from the email login button.
 */
@Component({
  templateUrl: './login.email.content.component.html',
  imports: [
    NgTemplateOutlet,
    DbxErrorComponent,
    DbxAnchorComponent,
    DbxLinkComponent,
    DbxActionErrorDirective,
    DbxActionFormDirective,
    DbxActionModule,
    DbxButtonComponent,
    DbxButtonSpacerDirective,
    DbxContentPitDirective,
    DbxFirebaseEmailForgeFormComponent,
    DbxFirebaseEmailRecoveryForgeFormComponent,
    DbxFormSourceDirective
  ]
})
export class DbxFirebaseLoginEmailContentComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly config = inject<DbxFirebaseLoginEmailContentComponentConfig>(DBX_INJECTION_COMPONENT_DATA);

  readonly formConfig: DbxFirebaseEmailFormConfig = {
    loginMode: this.config.loginMode,
    passwordConfig: this.config.passwordConfig
  };

  private readonly _emailFormValueSignal = signal<Maybe<DbxFirebaseEmailFormValue>>(this.config.defaultValue);
  private readonly _recoveryFormValueSignal = signal<Maybe<DbxFirebaseEmailRecoveryFormValue>>(this.config.defaultValue?.username ? { email: this.config.defaultValue.username } : undefined);
  private readonly _emailModeSignal = signal<DbxFirebaseLoginEmailContentMode>('login');

  readonly emailFormValueSignal = this._emailFormValueSignal.asReadonly();
  readonly recoveryFormValueSignal = this._recoveryFormValueSignal.asReadonly();
  readonly emailModeSignal = this._emailModeSignal.asReadonly();

  readonly forgotAnchor: ClickableAnchor = {
    onClick: () => {
      this.openRecovery();
    }
  };

  readonly passwordResetAnchor: Maybe<ClickableAnchor> = this.config.passwordResetAnchor;

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
    // TODO(signals): double check that this performs as we want to.

    this._emailFormValueSignal.set(value);
    this._recoveryFormValueSignal.set({ email: value.username }); // cache value for recovery

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
    this._recoveryFormValueSignal.set(value);
    this._emailFormValueSignal.set({ username: value.email, password: '' });
    context.startWorkingWithPromise(this.dbxFirebaseAuthService.sendPasswordReset(value.email));
  };

  // MARK: Recovering
  readonly handleRecoverySuccess: DbxActionSuccessHandlerFunction = (_x) => {
    this._emailModeSignal.set('recoversent');
  };

  /**
   * Whether the sent-recovery view sends the user on to the password reset page rather than back to the login form.
   *
   * @returns True when a password reset page is configured to land on.
   */
  get hasPasswordResetAnchor(): boolean {
    return this.passwordResetAnchor != null;
  }

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
