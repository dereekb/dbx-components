import { Component, ChangeDetectionStrategy } from '@angular/core';
import { AbstractSyncForgeFormDirective, forgeFixedDateRangeField, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule } from '@dereekb/dbx-form';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { type DateRange, DateRangeType } from '@dereekb/date';
import { type DocInteractionTestFilterFormValue } from './filter.custom.form.component';

export type DocInteractionTestDateFilterFormValue = {
  range: DateRange | null;
};

@Component({
  template: `
    <dbx-forge class="dbx-fixeddaterange-field-full-width"></dbx-forge>
  `,
  selector: 'doc-interaction-test-date-filter-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionTestDateFilterFormComponent extends AbstractSyncForgeFormDirective<DocInteractionTestFilterFormValue> {
  readonly config: FormConfig = {
    fields: [
      forgeFixedDateRangeField({
        key: 'range',
        selectionMode: 'normal',
        dateRangeInput: { type: DateRangeType.DAYS_RANGE, distance: 12 },
        pickerConfig: {
          limits: {
            min: 'today_start'
          }
        }
      })
    ]
  } as FormConfig;
}
