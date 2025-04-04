import { Component } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective, emailField, DbxFormlyModule, DbxFormlyComponent, FORMLY_FORM_COMPONENT_TEMPLATE } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFirebaseEmailRecoveryFormValue {
  email: string;
}

@Component({
  selector: 'dbx-firebase-email-recovery-form',
  template: FORMLY_FORM_COMPONENT_TEMPLATE.template,
  imports: FORMLY_FORM_COMPONENT_TEMPLATE.imports,
  providers: FORMLY_FORM_COMPONENT_TEMPLATE.providers,
  changeDetection: FORMLY_FORM_COMPONENT_TEMPLATE.changeDetection,
  standalone: true
})
export class DbxFirebaseEmailRecoveryFormComponent extends AbstractSyncFormlyFormDirective<DbxFirebaseEmailRecoveryFormValue> {
  readonly fields: FormlyFieldConfig[] = [emailField({ required: true })];
}
