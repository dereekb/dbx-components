import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideDbxForgeFormContext, AbstractSyncForgeFormDirective, forgeTextField, DbxForgeFormComponent } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  selector: 'doc-action-form-example-form-two',
  providers: [provideDbxForgeFormContext()],
  standalone: true,
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionFormExampleFormTwoComponent extends AbstractSyncForgeFormDirective<DocActionFormExampleValue> {
  readonly config: FormConfig = {
    fields: [forgeTextField({ key: 'name', label: 'Name', required: true })]
  } as FormConfig;
}
