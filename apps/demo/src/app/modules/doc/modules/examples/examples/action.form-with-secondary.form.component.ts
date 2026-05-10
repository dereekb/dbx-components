import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, AbstractSyncForgeFormDirective, dbxForgeTextField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocActionFormWithSecondaryFormValue {
  reason: string;
}

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-action-form-with-secondary-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionFormWithSecondaryFormComponent extends AbstractSyncForgeFormDirective<DocActionFormWithSecondaryFormValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgeTextField({
        key: 'reason',
        label: 'Reason',
        required: true,
        description: 'The Approve handler receives this value via dbxActionForm. Type something to enable Approve.'
      })
    ]
  } as FormConfig;
}
