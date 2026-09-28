import { DBX_INJECTION_COMPONENT_DATA, DbxInjectionComponent, type ClickableAnchor, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from './../service/firebase.auth.service';
import { firstValueFrom, from, tap } from 'rxjs';
import { Component, EventEmitter, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type DbxFirebaseLoginContext } from './login.context';
import { type DbxFirebaseEmailFormValue, type DbxFirebaseEmailFormConfig, DbxFirebaseEmailForgeFormComponent } from './login.email.forge.form.component';
import { type DbxFirebaseLoginMode } from './login';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { NgTemplateOutlet } from '@angular/common';
import { DbxActionErrorDirective, DbxActionModule, DbxLinkComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';
import { DbxFirebaseLoginEmailContentStore } from './login.email.content.store';
import { DbxFirebaseLoginEmailContentRecoveryComponent } from './login.email.content.recovery.component';
import { DbxFirebaseLoginEmailContentRecoverySentComponent } from './login.email.content.recovery.sent.component';
import { type DbxFirebaseLoginPasswordRecoveryViewsConfig } from './login.recovery';

/**
 * Configuration for the email login content component, specifying mode and password rules.
 */
export interface DbxFirebaseLoginEmailContentComponentConfig extends DbxFirebaseEmailFormConfig {
  readonly loginMode: DbxFirebaseLoginMode;
  /**
   * Anchor to the app's password reset page. When set, the password recovery views offer a "use a recovery code instead"
   * link to it for users that already hold a recovery code.
   */
  readonly passwordResetAnchor?: Maybe<ClickableAnchor>;
  /**
   * Custom views to show in place of the default password recovery views.
   */
  readonly passwordRecoveryViews?: Maybe<DbxFirebaseLoginPasswordRecoveryViewsConfig>;
  /**
   * Values to pre-populate the login form with, from a {@link DbxFirebaseLoginPrefill}.
   *
   * The username also seeds the recovery form, so a user that arrives with their address filled in and then follows
   * "Forgot Password?" is not asked for it a second time.
   */
  readonly defaultValue?: Maybe<DbxFirebaseEmailFormValue>;
}

/**
 * Full email login/registration flow component with login form, password recovery, and recovery confirmation states.
 *
 * Opened via the {@link DbxFirebaseLoginContext} injection context from the email login button. Provides the
 * {@link DbxFirebaseLoginEmailContentStore} that the password recovery views read from.
 */
@Component({
  templateUrl: './login.email.content.component.html',
  providers: [DbxFirebaseLoginEmailContentStore],
  imports: [NgTemplateOutlet, DbxErrorComponent, DbxLinkComponent, DbxActionErrorDirective, DbxActionFormDirective, DbxActionModule, DbxButtonComponent, DbxButtonSpacerDirective, DbxInjectionComponent, DbxFirebaseEmailForgeFormComponent, DbxFormSourceDirective]
})
export class DbxFirebaseLoginEmailContentComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly config = inject<DbxFirebaseLoginEmailContentComponentConfig>(DBX_INJECTION_COMPONENT_DATA);
  readonly store = inject(DbxFirebaseLoginEmailContentStore);

  readonly formConfig: DbxFirebaseEmailFormConfig = {
    loginMode: this.config.loginMode,
    passwordConfig: this.config.passwordConfig
  };

  readonly recoveryViewConfig: DbxInjectionComponentConfig = this.config.passwordRecoveryViews?.recoveryView ?? { componentClass: DbxFirebaseLoginEmailContentRecoveryComponent };
  readonly recoverySentViewConfig: DbxInjectionComponentConfig = this.config.passwordRecoveryViews?.recoverySentView ?? { componentClass: DbxFirebaseLoginEmailContentRecoverySentComponent };

  readonly emailFormValueSignal = toSignal(this.store.emailFormValue$);
  readonly recoveryFormValueSignal = toSignal(this.store.recoveryFormValue$);
  readonly emailModeSignal = toSignal(this.store.mode$, { initialValue: 'login' });

  readonly forgotAnchor: ClickableAnchor = {
    onClick: () => {
      this.openRecovery();
    }
  };

  readonly passwordResetAnchor: Maybe<ClickableAnchor> = this.config.passwordResetAnchor;

  readonly doneOrCancelled = new EventEmitter<boolean>();

  constructor() {
    this.store.setup({
      passwordResetAnchor: this.config.passwordResetAnchor,
      defaultValue: this.config.defaultValue
    });
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
    this.store.setEmailFormValue(value); // also caches the username for recovery

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
    this.store.openRecovery();
  }

  // MARK: Cancel
  onCancel() {
    this.doneOrCancelled.next(false);
  }
}
