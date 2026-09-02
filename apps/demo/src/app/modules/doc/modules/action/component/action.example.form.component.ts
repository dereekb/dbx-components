import { Component } from '@angular/core';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, AbstractSyncForgeFormDirective, dbxForgeNameField, dbxForgeDateTimeField, dbxForgeDateTimeRangeRow } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
  startTime: Date;
  endTime: Date;
}

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'doc-action-form-example-form',
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule]
})
export class DocActionFormExampleFormComponent extends AbstractSyncForgeFormDirective<DocActionFormExampleValue> {
  readonly formConfig: FormConfig = {
    fields: [
      dbxForgeNameField({ required: true }),
      dbxForgeDateTimeField({ key: 'date' }),
      dbxForgeDateTimeRangeRow({
        props: { showTimezone: true },
        start: { key: 'startTime', label: 'Start Time', hint: 'When the event begins.' },
        end: { key: 'endTime', label: 'End Time', hint: 'When the event ends.' }
      })
    ]
  } as FormConfig;
}
