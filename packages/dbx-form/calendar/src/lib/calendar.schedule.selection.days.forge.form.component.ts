import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, provideDbxForgeFormContext, DbxForgeFormComponent } from '@dereekb/dbx-form';
import { type EnabledDays } from '@dereekb/util';
import type { FormConfig } from '@ng-forge/dynamic-forms';
import { dbxScheduleSelectionCalendarDateDaysForgeFormFields } from './calendar.schedule.selection.forge.form';

export type DbxScheduleSelectionCalendarDateDaysForgeFormValue = EnabledDays;

@Component({
  selector: 'dbx-schedule-selection-calendar-date-days-forge-form',
  template: `
    <dbx-forge></dbx-forge>
  `,
  providers: provideDbxForgeFormContext(),
  imports: [DbxForgeFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDateDaysForgeFormComponent extends AbstractSyncForgeFormDirective<DbxScheduleSelectionCalendarDateDaysForgeFormValue> {
  readonly config: FormConfig = dbxScheduleSelectionCalendarDateDaysForgeFormFields();
}
