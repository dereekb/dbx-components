import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncFormlyFormDirective, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, dbxFormlyFormComponentProviders, textPasswordWithVerifyFieldGroup } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { FIREBASE_AUTH_PASSWORD_MIN_LENGTH } from '@dereekb/firebase';

/**
 * Form value for the password reset completion form containing the new password and verification.
 */
export interface DbxFirebasePasswordResetFormValue {
  readonly password: string;
  readonly verifyPassword: string;
}

/**
 * Formly-based form component for completing a password reset, containing new password and verify password fields.
 */
@Component({
  selector: 'dbx-firebase-password-reset-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  imports: [DbxFormlyFormComponentImportsModule],
  providers: dbxFormlyFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebasePasswordResetFormComponent extends AbstractSyncFormlyFormDirective<DbxFirebasePasswordResetFormValue> {
  readonly fields: FormlyFieldConfig[] = [textPasswordWithVerifyFieldGroup({ password: { minLength: FIREBASE_AUTH_PASSWORD_MIN_LENGTH } })];
}
