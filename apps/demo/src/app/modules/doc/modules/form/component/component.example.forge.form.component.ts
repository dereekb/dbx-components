import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { AbstractConfigAsyncForgeFormDirective, dbxForgeComponentField, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule } from '@dereekb/dbx-form';
import { type Maybe } from '@dereekb/util';
import { type DocFormExampleComponentFormConfig, DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN } from './component.example.form.component';

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-forge-example-component-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocForgeExampleComponentFormComponent extends AbstractConfigAsyncForgeFormDirective<unknown, DocFormExampleComponentFormConfig> {
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(
    map((config) => {
      if (!config) {
        return undefined;
      }

      return {
        fields: [
          dbxForgeComponentField({
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
          })
        ]
      } as const satisfies FormConfig;
    })
  );
}
