import { type Observable, map } from 'rxjs';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type DocFormExampleChecklistFieldsConfig, docFormExampleChecklistFieldsSection, type DocFormExampleChecklistValues } from './checklist.example';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractConfigAsyncFormlyFormDirective, provideFormlyContext, DbxFormlyComponent } from '@dereekb/dbx-form';
import { type BooleanKeyValueTransformMap } from '@dereekb/util';

export type DocFormExampleChecklistFormValue = BooleanKeyValueTransformMap<DocFormExampleChecklistValues>;

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-form-example-checklist-form',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleChecklistFormComponent extends AbstractConfigAsyncFormlyFormDirective<DocFormExampleChecklistFormValue, DocFormExampleChecklistFieldsConfig> {
  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(
    map((config) => {
      return [docFormExampleChecklistFieldsSection({ config })];
    })
  );
}
