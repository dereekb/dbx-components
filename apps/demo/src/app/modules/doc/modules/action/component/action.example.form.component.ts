import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideDbxForgeFormContext, AbstractSyncForgeFormDirective, forgeNameField, forgeDateTimeField, DbxForgeFormComponent } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';

export interface DocActionFormExampleValue {
  name: string;
  date: Date;
}

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  selector: 'doc-action-form-example-form',
  providers: [provideDbxForgeFormContext()],
  standalone: true,
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionFormExampleFormComponent extends AbstractSyncForgeFormDirective<DocActionFormExampleValue> {
  readonly config: FormConfig = {
    fields: [forgeNameField({ required: true }), forgeDateTimeField({ key: 'date' })]
  } as FormConfig;
}
