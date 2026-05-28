import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgeTextField, dbxForgeTextPasswordWithVerifyField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { type FirebaseAuthOobCode, FIREBASE_AUTH_PASSWORD_MIN_LENGTH } from '@dereekb/firebase';
import { type Maybe, type PasswordString } from '@dereekb/util';
import { map, type Observable } from 'rxjs';

/**
 * Form value for the password reset completion form containing the new password and verification.
 */
export interface DbxFirebasePasswordResetFormValue {
  readonly oobCode?: FirebaseAuthOobCode;
  readonly password: PasswordString;
  readonly verifyPassword: PasswordString;
}

/**
 * Configuration for the password reset form.
 */
export interface DbxFirebasePasswordResetFormConfig {
  /**
   * Whether to render a text field for the oobCode/reset token.
   *
   * Set to true when the oobCode is not already supplied by the surrounding context (e.g. via a route param).
   */
  readonly showOobCodeInput?: boolean;
}

/**
 * Forge-based form component for completing a password reset.
 *
 * Renders New Password + Verify Password fields, and optionally a reset code field when {@link DbxFirebasePasswordResetFormConfig.showOobCodeInput} is true.
 */
@Component({
  selector: 'dbx-firebase-password-reset-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  imports: [DbxForgeFormComponentImportsModule],
  providers: dbxForgeFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebasePasswordResetFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebasePasswordResetFormValue, DbxFirebasePasswordResetFormConfig> {
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      const showOobCodeInput = config?.showOobCodeInput ?? false;
      const [passwordField, verifyPasswordField] = dbxForgeTextPasswordWithVerifyField({
        password: {
          label: 'New Password',
          minLength: FIREBASE_AUTH_PASSWORD_MIN_LENGTH
        }
      });

      const fields = [
        ...(showOobCodeInput
          ? [
              dbxForgeTextField({
                key: 'oobCode',
                label: 'Reset Code',
                required: true
              })
            ]
          : []),
        passwordField,
        verifyPasswordField
      ];

      return { fields };
    })
  );
}
