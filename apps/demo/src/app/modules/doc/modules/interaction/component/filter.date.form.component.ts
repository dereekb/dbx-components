import { Component } from '@angular/core';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { AbstractSyncFormlyFormDirective, fixedDateRangeField, provideFormlyContext, DbxFormlyComponent } from '@dereekb/dbx-form';
import { DateRange, DateRangeType } from '@dereekb/date';
import { DocInteractionTestFilterFormValue } from './filter.custom.form.component';

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
  imports: [DbxFormlyComponent]
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
