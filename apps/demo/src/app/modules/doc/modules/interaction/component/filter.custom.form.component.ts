import { type DocInteractionTestFilter } from './filter';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AbstractSyncForgeFormDirective, dbxForgeDateTimeField, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgeTextField } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export type DocInteractionTestFilterFormValue = DocInteractionTestFilter;

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-interaction-test-filter-custom-filter-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionTestFilterCustomFilterFormComponent extends AbstractSyncForgeFormDirective<DocInteractionTestFilterFormValue> {
  readonly formConfig: FormConfig = {
    fields: [dbxForgeTextField({ key: 'name', label: 'Name' }), dbxForgeDateTimeField({ key: 'date', label: 'Time' })]
  } as FormConfig;
}
