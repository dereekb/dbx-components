import { Component } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective, nameField, dateTimeField } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { DbxFormlyComponent } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.form.component';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
    template: `
    <dbx-formly></dbx-formly>
  `,
    selector: 'doc-action-form-example-form',
    providers: [provideFormlyContext()],
    standalone: true,
    imports: [DbxFormlyComponent]
})
export class DocActionFormExampleFormComponent extends AbstractSyncFormlyFormDirective<DocActionFormExampleValue> {
  readonly fields: FormlyFieldConfig[] = [nameField({ required: true }), dateTimeField({ key: 'date' })];
}
