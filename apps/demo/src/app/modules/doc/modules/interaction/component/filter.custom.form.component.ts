import { DocInteractionTestFilter } from './filter';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractSyncFormlyFormDirective, dateTimeField, provideFormlyContext, textField } from '@dereekb/dbx-form';
import { DbxFormlyComponent } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.form.component';

export type DocInteractionTestFilterFormValue = DocInteractionTestFilter;

@Component({
    template: `
    <dbx-formly></dbx-formly>
  `,
    selector: 'dbx-interaction-test-filter-custom-filter-form',
    providers: provideFormlyContext(),
    standalone: true,
    imports: [DbxFormlyComponent]
})
export class DocInteractionTestFilterCustomFilterFormComponent extends AbstractSyncFormlyFormDirective<DocInteractionTestFilterFormValue> {
  readonly fields: FormlyFieldConfig[] = [textField({ key: 'name', label: 'Name' }), dateTimeField({ key: 'date', label: 'Time' })];
}
