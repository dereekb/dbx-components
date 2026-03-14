import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncFormlyFormDirective, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, dbxFormlyFormComponentProviders, emailField } from '@dereekb/dbx-form';
import { type FormlyFieldConfig } from '@ngx-formly/core';

/** Form value for the password recovery form containing the email address. */
export interface DbxFirebaseEmailRecoveryFormValue {
  email: string;
}

/** Formly-based form component for password recovery, containing a single email field. */
@Component({
  selector: 'dbx-firebase-email-recovery-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  imports: [DbxFormlyFormComponentImportsModule],
  providers: dbxFormlyFormComponentProviders(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseEmailRecoveryFormComponent extends AbstractSyncFormlyFormDirective<DbxFirebaseEmailRecoveryFormValue> {
  readonly fields: FormlyFieldConfig[] = [emailField({ required: true })];
}
