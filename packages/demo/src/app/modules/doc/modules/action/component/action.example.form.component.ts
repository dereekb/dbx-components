import { Component } from "@angular/core";
import { ProvideFormlyContext, AbstractSyncFormlyFormDirective, nameField, timeOnlyField, dateTimeField } from "@dereekb/dbx-form";
import { FormlyFieldConfig } from "@ngx-formly/core";

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'doc-action-form-example-form',
  providers: [ProvideFormlyContext()]
})
export class DocActionFormExampleFormComponent extends AbstractSyncFormlyFormDirective<DocActionFormExampleValue> {

  readonly fields: FormlyFieldConfig[] = [
    nameField({ required: true }),
    dateTimeField({ key: 'date' })
  ];

}
