import { Component } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective, emailField, DbxFormlyModule, DbxFormlyFormComponent } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

export interface DbxFirebaseEmailRecoveryFormValue {
  email: string;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-firebase-email-recovery-form',
  imports: [DbxFormlyFormComponent],
  providers: [provideFormlyContext()],
  standalone: true
})
export class DbxFirebaseEmailRecoveryFormComponent extends AbstractSyncFormlyFormDirective<DbxFirebaseEmailRecoveryFormValue> {
  readonly fields: FormlyFieldConfig[] = [emailField({ required: true })];
}
