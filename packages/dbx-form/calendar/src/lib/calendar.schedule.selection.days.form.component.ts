import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncFormlyFormDirective, dbxFormlyFormComponentProviders, DBX_FORMLY_FORM_COMPONENT_TEMPLATE, DbxFormlyFormComponentImportsModule, DbxFormFormlyWrapperModule, DbxFormFormlyBooleanFieldModule } from '@dereekb/dbx-form';
import { EnabledDays } from '@dereekb/util';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { dbxScheduleSelectionCalendarDateDaysFormFields } from './calendar.schedule.selection.form';

export type DbxScheduleSelectionCalendarDateDaysFormValue = EnabledDays;

@Component({
  selector: 'dbx-schedule-selection-calendar-date-days-form',
  template: DBX_FORMLY_FORM_COMPONENT_TEMPLATE,
  providers: dbxFormlyFormComponentProviders(),
  imports: [DbxFormlyFormComponentImportsModule, DbxFormFormlyWrapperModule, DbxFormFormlyBooleanFieldModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDateDaysFormComponent extends AbstractSyncFormlyFormDirective<DbxScheduleSelectionCalendarDateDaysFormValue> {
  readonly fields: FormlyFieldConfig[] = dbxScheduleSelectionCalendarDateDaysFormFields();
}
