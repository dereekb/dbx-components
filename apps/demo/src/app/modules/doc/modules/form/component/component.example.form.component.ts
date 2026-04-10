import { LOREM } from './../../shared/lorem';
import { type Type, InjectionToken, inject, Component, ChangeDetectionStrategy } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractConfigAsyncFormlyFormDirective, componentField, provideFormlyContext, DbxFormlyComponent } from '@dereekb/dbx-form';
import { DbxContentBoxDirective, DbxSectionComponent, DbxLinkComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';

export const DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN = new InjectionToken('DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN');

export interface DocFormExampleComponentFormValue {}

export interface DocFormExampleComponentFormConfig {
  componentClass: Type<any>;
  readonly allowDisabledEffects?: Maybe<boolean>;
}

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'doc-form-example-component-form',
  providers: [provideFormlyContext()],
  standalone: true,
  imports: [DbxFormlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  imports: [DbxContentBoxDirective, DbxSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleComponentFormTestViewAComponent {
  lorem = LOREM;

  readonly injectedData = inject(DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN) as string;
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
  imports: [DbxLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleComponentFormTestViewBComponent {}
