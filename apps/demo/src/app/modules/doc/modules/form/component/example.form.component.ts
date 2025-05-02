import { Component } from '@angular/core';
import { provideFormlyContext, AbstractConfigAsyncFormlyFormDirective, DbxFormlyComponent, DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { map, Observable } from 'rxjs';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
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
