import { LOREM } from './../../shared/lorem';
import { Type } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractConfigAsyncFormlyFormDirective, componentField, ProvideFormlyContext } from '@dereekb/dbx-form';

export interface DocFormExampleComponentFormValue { }

export interface DocFormExampleComponentFormConfig {
  componentClass: Type<any>;
}

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'dbx-form-example-component-form',
  providers: [ProvideFormlyContext()]
})
export class DocFormExampleComponentFormComponent extends AbstractConfigAsyncFormlyFormDirective<DocFormExampleComponentFormValue, DocFormExampleComponentFormConfig> {

  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(
    map((config) => {
      return [
        componentField({
          componentClass: config.componentClass
        })
      ];
    })
  );

}

@Component({
  template: `
  <div class="pad-3">
    <dbx-content-box class="dbx-primary-bg">
      <dbx-section header="A" [hint]="lorem"></dbx-section>
    </dbx-content-box>
  </div>
  `
})
export class DocFormExampleComponentFormTestViewAComponent {

  lorem = LOREM;

}

@Component({
  template: `
    <div>
      <p>
        <dbx-link>Privacy Policy</dbx-link>
      </p>
      <p>
        <dbx-link>Terms of Service</dbx-link>
      </p>
    </div>
`
})
export class DocFormExampleComponentFormTestViewBComponent {

}
