import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, AbstractSyncForgeFormDirective, forgeNameField, forgeDateTimeField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-action-form-example-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionFormExampleFormComponent extends AbstractSyncForgeFormDirective<DocActionFormExampleValue> {
  readonly formConfig: FormConfig = {
    fields: [forgeNameField({ required: true }), forgeDateTimeField({ key: 'date' })]
  } as FormConfig;
}
