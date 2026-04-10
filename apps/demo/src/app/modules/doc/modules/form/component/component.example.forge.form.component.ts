import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { AbstractConfigAsyncForgeFormDirective, forgeComponentField, provideDbxForgeFormContext, DbxForgeFormComponent } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import { type DocFormExampleComponentFormConfig, DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN } from './component.example.form.component';

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  selector: 'doc-forge-example-component-form',
  providers: [provideDbxForgeFormContext()],
  standalone: true,
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocForgeExampleComponentFormComponent extends AbstractConfigAsyncForgeFormDirective<unknown, DocFormExampleComponentFormConfig> {
  readonly config$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }

      return {
        fields: [
          forgeComponentField({
            componentField: {
              componentClass: config.componentClass,
              providers: [
                {
                  provide: DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN,
                  useValue: 'example injected value'
                }
              ]
            },
            allowDisabledEffects: config.allowDisabledEffects ?? true
          }) as any
        ]
      } satisfies FormConfig;
    })
  );
}
