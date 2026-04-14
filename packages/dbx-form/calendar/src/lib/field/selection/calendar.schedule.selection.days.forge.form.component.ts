import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule } from '@dereekb/dbx-form';
import { type EnabledDays } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { dbxScheduleSelectionCalendarDateDaysForgeFormFields } from './calendar.schedule.selection.forge.form';

export type DbxScheduleSelectionCalendarDateDaysForgeFormValue = EnabledDays;

@Component({
  selector: 'dbx-schedule-selection-calendar-date-days-forge-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDateDaysForgeFormComponent extends AbstractSyncForgeFormDirective<DbxScheduleSelectionCalendarDateDaysForgeFormValue> {
  readonly formConfig: FormConfig = dbxScheduleSelectionCalendarDateDaysForgeFormFields();
}
