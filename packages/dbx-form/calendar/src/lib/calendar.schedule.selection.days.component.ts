import { Component } from '@angular/core';
import { dateCellScheduleDayCodesAreSetsEquivalent, dateCellScheduleDayCodesFromEnabledDays, enabledDaysFromDateCellScheduleDayCodes } from '@dereekb/date';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { IsModifiedFunction } from '@dereekb/rxjs';
import { map, shareReplay, Observable, of } from 'rxjs';
import { DbxScheduleSelectionCalendarDateDaysFormValue } from './calendar.schedule.selection.days.form.component';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-days',
  template: `
    <div class="dbx-schedule-selection-calendar-date-days" dbxAction dbxActionAutoTrigger dbxActionEnforceModified [instantTrigger]="true" [dbxActionHandler]="updateScheduleDays">
      <dbx-schedule-selection-calendar-date-days-form dbxActionForm [dbxFormSource]="template$" [dbxActionFormModified]="isFormModified"></dbx-schedule-selection-calendar-date-days-form>
    </div>
  `
})
export class DbxScheduleSelectionCalendarDateDaysComponent {
  readonly template$: Observable<DbxScheduleSelectionCalendarDateDaysFormValue> = this.dbxCalendarScheduleSelectionStore.scheduleDays$.pipe(map(enabledDaysFromDateCellScheduleDayCodes), shareReplay(1));

  readonly isFormModified: IsModifiedFunction<DbxScheduleSelectionCalendarDateDaysFormValue> = (value: DbxScheduleSelectionCalendarDateDaysFormValue) => {
    const newSetValue = new Set(dateCellScheduleDayCodesFromEnabledDays(value));
    return this.dbxCalendarScheduleSelectionStore.scheduleDays$.pipe(
      map((currentSet) => {
        const result = !dateCellScheduleDayCodesAreSetsEquivalent(newSetValue, currentSet);
        return result;
      })
    );
  };

  constructor(readonly dbxCalendarStore: DbxCalendarStore, readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}

  readonly updateScheduleDays: WorkUsingObservable<DbxScheduleSelectionCalendarDateDaysFormValue> = (value) => {
    this.dbxCalendarScheduleSelectionStore.setScheduleDays(new Set(dateCellScheduleDayCodesFromEnabledDays(value)));
    return of(true);
  };
}
