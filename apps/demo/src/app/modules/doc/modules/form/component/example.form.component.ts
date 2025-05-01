import { Component } from '@angular/core';
import { provideFormlyContext, AbstractConfigAsyncFormlyFormDirective } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable } from 'rxjs';
import { DbxFormlyComponent } from '../../../../../../../../../packages/dbx-form/src/lib/formly/formly.form.component';
import { DbxFormValueChangeDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/io/form.change.directive';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { JsonPipe } from '@angular/common';

@Component({
    exportAs: 'exampleForm',
    template: `
    <div>
      <dbx-formly (dbxFormValueChange)="value = $event"></dbx-formly>
      <p></p>
      <dbx-content-border style="white-space: break-spaces;">
        <p>> {{ value | json }}</p>
      </dbx-content-border>
    </div>
  `,
    selector: 'doc-form-example-form',
    providers: [provideFormlyContext()],
    standalone: true,
    imports: [DbxFormlyComponent, DbxFormValueChangeDirective, DbxContentBorderDirective, JsonPipe]
})
export class DocFormExampleComponent extends AbstractConfigAsyncFormlyFormDirective<any, FormlyFieldConfig[]> {
  value: any;
  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(map((fields: FormlyFieldConfig[]) => fields ?? []));
}
