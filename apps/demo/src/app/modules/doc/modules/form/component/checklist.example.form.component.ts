import { Observable, map } from 'rxjs';
import { Component } from '@angular/core';
import { DocFormExampleChecklistFieldsConfig, docFormExampleChecklistFieldsSection, DocFormExampleChecklistValues } from './checklist.example';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractConfigAsyncFormlyFormDirective, provideFormlyContext, DbxFormlyComponent } from '@dereekb/dbx-form';
import { BooleanKeyValueTransformMap } from '@dereekb/util';

export type DocFormExampleChecklistFormValue = BooleanKeyValueTransformMap<DocFormExampleChecklistValues>;

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-form-example-checklist-form',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent]
})
export class DocFormExampleChecklistFormComponent extends AbstractConfigAsyncFormlyFormDirective<DocFormExampleChecklistFormValue, DocFormExampleChecklistFieldsConfig> {
  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(
    map((config) => {
      return [docFormExampleChecklistFieldsSection({ config })];
    })
  );
}
