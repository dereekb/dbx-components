import { Component } from "@angular/core";
import { ProvideFormlyContext, AbstractConfigAsyncFormlyFormDirective, componentField } from "@dereekb/dbx-form";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { map, Observable } from "rxjs";

@Component({
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
  providers: [ProvideFormlyContext()]
})
export class DocFormExampleComponent extends AbstractConfigAsyncFormlyFormDirective<any, FormlyFieldConfig[]> {

  value: any;

  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(map((fields: FormlyFieldConfig[]) => fields ?? []));

}
