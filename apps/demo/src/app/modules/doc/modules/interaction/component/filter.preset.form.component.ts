import { DocInteractionTestFilter } from './filter';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractSyncFormlyFormDirective, ProvideFormlyContext } from '@dereekb/dbx-form';

export type DocInteractionTestFilterFormValue = DocInteractionTestFilter

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'dbx-interaction-test-filter-preset-filter-form',
  providers: ProvideFormlyContext()
})
export class DocInteractionTestFilterPresetFilterFormComponent extends AbstractSyncFormlyFormDirective<DocInteractionTestFilterFormValue> {

  readonly fields: FormlyFieldConfig[] = [
    // TODO: add fields
  ];

}
