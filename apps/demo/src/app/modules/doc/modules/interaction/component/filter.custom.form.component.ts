import { type DocInteractionTestFilter } from './filter';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AbstractSyncForgeFormDirective, forgeDateTimeField, provideDbxForgeFormContext, forgeTextField, DbxForgeFormComponent } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export type DocInteractionTestFilterFormValue = DocInteractionTestFilter;

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  selector: 'doc-interaction-test-filter-custom-filter-form',
  providers: provideDbxForgeFormContext(),
  standalone: true,
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionTestFilterCustomFilterFormComponent extends AbstractSyncForgeFormDirective<DocInteractionTestFilterFormValue> {
  readonly config: FormConfig = {
    fields: [forgeTextField({ key: 'name', label: 'Name' }), forgeDateTimeField({ key: 'date', label: 'Time' })]
  } as FormConfig;
}
