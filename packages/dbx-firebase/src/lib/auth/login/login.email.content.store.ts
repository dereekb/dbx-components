import { Injectable, inject } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { firebaseAuthErrorToReadableError } from '@dereekb/firebase';
import { type EmailAddress, type Maybe } from '@dereekb/util';
import { distinctUntilChanged, map } from 'rxjs';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { type DbxFirebaseEmailFormValue } from './login.email.forge.form.component';
import { type DbxFirebaseEmailRecoveryFormValue } from './login.email.recovery.forge.form.component';

/**
 * UI state of the email login content: login form, password recovery form, or recovery sent confirmation.
 */
export type DbxFirebaseLoginEmailContentMode = 'login' | 'recover' | 'recoversent';

/**
 * State shape for the {@link DbxFirebaseLoginEmailContentStore}.
 */
export interface DbxFirebaseLoginEmailContentStoreState {
  /**
   * The view currently shown by the email login content.
   */
  readonly mode: DbxFirebaseLoginEmailContentMode;
  /**
   * Anchor to the app's password reset page, where a user can enter a recovery code they already hold.
   */
  readonly passwordResetAnchor?: Maybe<ClickableAnchor>;
  /**
   * Last value of the login form. Seeds the login form when the user returns to it from recovery.
   */
  readonly emailFormValue?: Maybe<DbxFirebaseEmailFormValue>;
  /**
   * Last value of the recovery form. Seeds the recovery form so the user is not asked for their address twice.
   */
  readonly recoveryFormValue?: Maybe<DbxFirebaseEmailRecoveryFormValue>;
  /**
   * Address the most recent password reset email was sent to.
   */
  readonly recoveryEmailSentTo?: Maybe<EmailAddress>;
}

/**
 * Input for {@link DbxFirebaseLoginEmailContentStore.setup}.
 */
export interface DbxFirebaseLoginEmailContentStoreSetup {
  readonly passwordResetAnchor?: Maybe<ClickableAnchor>;
  /**
   * Values to pre-populate the login form with. The username also seeds the recovery form.
   */
  readonly defaultValue?: Maybe<DbxFirebaseEmailFormValue>;
}

const INITIAL_STATE: DbxFirebaseLoginEmailContentStoreState = {
  mode: 'login'
};

/**
 * NgRx ComponentStore that carries the state of a single email login flow: which view is shown, the values entered
 * into the login and recovery forms, and the address a password reset email was sent to.
 *
 * Provided by {@link DbxFirebaseLoginEmailContentComponent}. The password recovery views it renders, including any
 * custom views configured through {@link DbxFirebaseLoginPasswordRecoveryViewsConfig}, resolve it through the element
 * injector.
 */
@Injectable()
export class DbxFirebaseLoginEmailContentStore extends ComponentStore<DbxFirebaseLoginEmailContentStoreState> {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  constructor() {
    super({ ...INITIAL_STATE });
  }

  // MARK: Accessors
  readonly mode$ = this.state$.pipe(
    map((x) => x.mode),
    distinctUntilChanged()
  );

  readonly passwordResetAnchor$ = this.state$.pipe(
    map((x) => x.passwordResetAnchor),
    distinctUntilChanged()
  );

  readonly emailFormValue$ = this.state$.pipe(
    map((x) => x.emailFormValue),
    distinctUntilChanged()
  );

  readonly recoveryFormValue$ = this.state$.pipe(
    map((x) => x.recoveryFormValue),
    distinctUntilChanged()
  );

  readonly recoveryEmailSentTo$ = this.state$.pipe(
    map((x) => x.recoveryEmailSentTo),
    distinctUntilChanged()
  );

  // MARK: Password Reset
  /**
   * Caches the entered recovery value, then sends a password reset email to its address.
   *
   * Does not change the view. Call {@link markRecoverySent} from the action's success handler once the send completes.
   *
   * @param value - Holds the address to send the reset email to.
   * @returns Resolves once the reset email is sent; rejects with a readable error when the send fails.
   */
  sendPasswordReset(value: DbxFirebaseEmailRecoveryFormValue): Promise<void> {
    this.setRecoveryFormValue(value);

    return this.dbxFirebaseAuthService.sendPasswordReset(value.email).catch((error) => {
      throw firebaseAuthErrorToReadableError(error);
    });
  }

  // MARK: State Changes
  /**
   * Initializes the store from the email login content configuration.
   */
  readonly setup = this.updater((state, setup: DbxFirebaseLoginEmailContentStoreSetup) => {
    const { passwordResetAnchor, defaultValue } = setup;

    return {
      ...state,
      passwordResetAnchor,
      emailFormValue: defaultValue,
      recoveryFormValue: defaultValue?.username ? { email: defaultValue.username } : state.recoveryFormValue
    };
  });

  /**
   * Caches the login form value, and its username as the recovery form value.
   */
  readonly setEmailFormValue = this.updater((state, emailFormValue: DbxFirebaseEmailFormValue) => ({
    ...state,
    emailFormValue,
    recoveryFormValue: { email: emailFormValue.username }
  }));

  /**
   * Caches the recovery form value, and its email as the login form username.
   */
  readonly setRecoveryFormValue = this.updater((state, recoveryFormValue: DbxFirebaseEmailRecoveryFormValue) => ({
    ...state,
    recoveryFormValue,
    emailFormValue: { username: recoveryFormValue.email, password: '' }
  }));

  readonly openRecovery = this.updater((state) => ({ ...state, mode: 'recover' as const }));

  readonly returnToLogin = this.updater((state) => ({ ...state, mode: 'login' as const }));

  /**
   * Shows the recovery sent view, recording the cached recovery address as the address the email was sent to.
   */
  readonly markRecoverySent = this.updater((state) => ({
    ...state,
    mode: 'recoversent' as const,
    recoveryEmailSentTo: state.recoveryFormValue?.email
  }));
}
