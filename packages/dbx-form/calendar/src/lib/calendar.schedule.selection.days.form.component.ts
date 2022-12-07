import { Component } from '@angular/core';
import { AbstractSyncFormlyFormDirective, provideFormlyContext } from '@dereekb/dbx-form';
import { EnabledDays } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { dbxScheduleSelectionCalendarDateDaysFormFields } from './calendar.schedule.selection.form';

export type DbxScheduleSelectionCalendarDateDaysFormValue = EnabledDays;

@Component({
  template: `
    <dbx-formly></dbx-formly>
  `,
  selector: 'dbx-schedule-selection-calendar-date-days-form',
  providers: [provideFormlyContext()]
})
export class DbxScheduleSelectionCalendarDateDaysFormComponent extends AbstractSyncFormlyFormDirective<DbxScheduleSelectionCalendarDateDaysFormValue> {
  readonly fields: FormlyFieldConfig[] = dbxScheduleSelectionCalendarDateDaysFormFields();
}
