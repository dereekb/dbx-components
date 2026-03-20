import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractSyncFormlyFormDirective, fixedDateRangeField, provideFormlyContext, DbxFormlyComponent } from '@dereekb/dbx-form';
import { type DateRange, DateRangeType } from '@dereekb/date';
import { type DocInteractionTestFilterFormValue } from './filter.custom.form.component';

export type DocInteractionTestDateFilterFormValue = {
  range: DateRange | null;
};

@Component({
  template: `
    <dbx-formly class="dbx-fixeddaterange-field-full-width"></dbx-formly>
  `,
  selector: 'doc-interaction-test-date-filter-form',
  providers: provideFormlyContext(),
  standalone: true,
  imports: [DbxFormlyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionTestDateFilterFormComponent extends AbstractSyncFormlyFormDirective<DocInteractionTestFilterFormValue> {
  readonly fields: FormlyFieldConfig[] = [
    fixedDateRangeField({
      key: 'range',
      selectionMode: 'normal',
      dateRangeInput: { type: DateRangeType.DAYS_RANGE, distance: 12 },
      pickerConfig: {
        limits: {
          min: 'today_start'
        }
      }
    })
  ];
}
