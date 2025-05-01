import { Component } from '@angular/core';
import { provideFormlyContext, AbstractSyncFormlyFormDirective, textField, DbxFormlyComponent } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'doc-action-form-example-form-two',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent]
})
export class DocActionFormExampleFormTwoComponent extends AbstractSyncFormlyFormDirective<DocActionFormExampleValue> {
  readonly fields: FormlyFieldConfig[] = [textField({ key: 'name', label: 'Name', maxLength: 30, required: true, autocomplete: false })];
}
