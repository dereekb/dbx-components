import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, AbstractSyncForgeFormDirective, forgeTextField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-action-form-example-form-two',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionFormExampleFormTwoComponent extends AbstractSyncForgeFormDirective<DocActionFormExampleValue> {
  readonly formConfig: FormConfig = {
    fields: [forgeTextField({ key: 'name', label: 'Name', required: true })]
  } as FormConfig;
}
