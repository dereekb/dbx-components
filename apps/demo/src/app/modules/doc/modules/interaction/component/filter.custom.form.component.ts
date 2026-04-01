import { type DocInteractionTestFilter } from './filter';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractSyncFormlyFormDirective, dateTimeField, provideFormlyContext, textField, DbxFormlyComponent } from '@dereekb/dbx-form';

export type DocInteractionTestFilterFormValue = DocInteractionTestFilter;

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'doc-interaction-test-filter-custom-filter-form',
  providers: provideFormlyContext(),
  standalone: true,
  imports: [DbxFormlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionTestFilterCustomFilterFormComponent extends AbstractSyncFormlyFormDirective<DocInteractionTestFilterFormValue> {
  readonly fields: FormlyFieldConfig[] = [textField({ key: 'name', label: 'Name' }), dateTimeField({ key: 'date', label: 'Time' })];
}
