import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncFormlyFormDirective, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, dbxFormlyFormComponentProviders, emailField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFirebaseEmailRecoveryFormValue {
  email: string;
}

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
