import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, provideDbxForgeFormContext, DbxForgeFormComponent, forgeTextPasswordField, forgeTextVerifyPasswordField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { FIREBASE_AUTH_PASSWORD_MIN_LENGTH } from '@dereekb/firebase';

/**
 * Form value for the password reset completion form containing the new password and verification.
 */
export interface DbxFirebasePasswordResetFormValue {
  readonly password: string;
  readonly verifyPassword: string;
}

/**
 * Forge-based form component for completing a password reset, containing new password and verify password fields.
 */
@Component({
  selector: 'dbx-firebase-password-reset-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  imports: [DbxForgeFormComponent],
  providers: provideDbxForgeFormContext(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebasePasswordResetFormComponent extends AbstractSyncForgeFormDirective<DbxFirebasePasswordResetFormValue> {
  readonly config: FormConfig = {
    fields: [
      forgeTextPasswordField({ minLength: FIREBASE_AUTH_PASSWORD_MIN_LENGTH }),
      {
        ...forgeTextVerifyPasswordField(),
        validators: [
          {
            type: 'custom',
            expression: 'fieldValue === formValue.password',
            kind: 'passwordMismatch'
          }
        ],
        validationMessages: {
          passwordMismatch: 'The passwords do not match.'
        }
      }
    ]
  };
}
