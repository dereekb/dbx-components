import { LOREM } from './../../shared/lorem';
import { Type, InjectionToken, Inject, Component } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractConfigAsyncFormlyFormDirective, componentField, provideFormlyContext, DbxFormlyComponent } from '@dereekb/dbx-form';
import { DbxContentBoxDirective, DbxSectionComponent, DbxLinkComponent } from '@dereekb/dbx-web';

export const DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN = new InjectionToken('DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN');

export interface DocFormExampleComponentFormValue {}

export interface DocFormExampleComponentFormConfig {
  componentClass: Type<any>;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-form-example-component-form',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent]
})
export class DocFormExampleComponentFormComponent extends AbstractConfigAsyncFormlyFormDirective<DocFormExampleComponentFormValue, DocFormExampleComponentFormConfig> {
  readonly fields$: Observable<FormlyFieldConfig[]> = this.config$.pipe(
    map((config) => {
      return [
        componentField({
          componentClass: config.componentClass,
          providers: [
            {
              provide: DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN,
              useValue: 'example injected value'
            }
          ]
        })
      ];
    })
  );
}

@Component({
  template: `
    <div class="dbx-p3">
      <dbx-content-box class="dbx-primary-bg">
        <dbx-section header="A" [hint]="lorem">
          <p>Data injected from configuration: {{ injectedData }}</p>
        </dbx-section>
      </dbx-content-box>
    </div>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxSectionComponent]
})
export class DocFormExampleComponentFormTestViewAComponent {
  lorem = LOREM;

  constructor(@Inject(DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN) readonly injectedData: string) {}
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
  `,
  standalone: true,
  imports: [DbxLinkComponent]
})
export class DocFormExampleComponentFormTestViewBComponent {}
