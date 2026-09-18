import { Component } from '@angular/core';
import { AbstractConfigAsyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgeTextField, dbxForgeTextPasswordWithVerifyField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { type FirebaseAuthOobCode, FIREBASE_AUTH_PASSWORD_MIN_LENGTH } from '@dereekb/firebase';
import { type Maybe, type PasswordString } from '@dereekb/util';
import { map, type Observable } from 'rxjs';

/**
 * Default placeholder for the reset code input.
 *
 * Mirrors the `<code>-<uid>` composite token shape produced by `encodeFirebaseServerUserPasswordResetOobCode()` in
 * `@dereekb/firebase-server` (a six-digit reset code followed by a 28-character Firebase uid), which is the value the
 * reset email delivers when the delegate routes the reset through a claims-based backend.
 */
export const DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PLACEHOLDER = '000000-0000000000000000000000000000';

/**
 * Default pattern the reset code input must match: a six-digit code, a dash, then a 28-character alphanumeric Firebase uid.
 *
 * Catches the common paste mistakes (only the six-digit code, only the uid, or extra characters) before the request is sent.
 * Override it via {@link DbxFirebasePasswordResetFormConfig.oobCodePattern} for apps whose uids or codes have a different shape.
 */
export const DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN = /^\d{6}-[A-Za-z0-9]{28}$/;

/**
 * Default hint shown under the reset code input.
 */
export const DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_HINT = 'Copy this code from your password reset email.';

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
  /**
   * Placeholder shown in the reset code field when {@link showOobCodeInput} is true.
   *
   * Defaults to {@link DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PLACEHOLDER}. Override it when the delegate expects a
   * differently-shaped token.
   */
  readonly oobCodePlaceholder?: Maybe<string>;
  /**
   * Pattern the reset code must match when {@link showOobCodeInput} is true.
   *
   * Defaults to {@link DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN}. Pass `false` to skip the format check entirely.
   */
  readonly oobCodePattern?: Maybe<string | RegExp | false>;
  /**
   * Hint shown under the reset code field when {@link showOobCodeInput} is true.
   *
   * Defaults to {@link DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_HINT}.
   */
  readonly oobCodeHint?: Maybe<string>;
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
  providers: dbxForgeFormComponentProviders()
})
export class DbxFirebasePasswordResetFormComponent extends AbstractConfigAsyncForgeFormDirective<DbxFirebasePasswordResetFormValue, DbxFirebasePasswordResetFormConfig> {
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      const showOobCodeInput = config?.showOobCodeInput ?? false;
      const oobCodePlaceholder = config?.oobCodePlaceholder ?? DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PLACEHOLDER;
      const oobCodePattern = config?.oobCodePattern ?? DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_PATTERN;
      const oobCodeHint = config?.oobCodeHint ?? DEFAULT_DBX_FIREBASE_PASSWORD_RESET_OOB_CODE_HINT;
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
                required: true,
                placeholder: oobCodePlaceholder,
                hint: oobCodeHint,
                pattern: oobCodePattern || undefined,
                validationMessages: { pattern: `Enter the full reset code from your email. It should look like ${oobCodePlaceholder}.` },
                // The token is pasted from an email; stray surrounding whitespace would otherwise fail verification.
                idempotentTransform: { trim: true },
                // Not a browser-managed credential, and not an SMS code either — keep autofill suggestions out of the way.
                autocomplete: false
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
