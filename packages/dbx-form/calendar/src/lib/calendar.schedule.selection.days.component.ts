import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { dateCellScheduleDayCodesAreSetsEquivalent, dateCellScheduleDayCodesFromEnabledDays, enabledDaysFromDateCellScheduleDayCodes } from '@dereekb/date';
import { type WorkUsingObservable, type IsModifiedFunction } from '@dereekb/rxjs';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { map, shareReplay, type Observable, of } from 'rxjs';
import { DbxScheduleSelectionCalendarDateDaysForgeFormComponent, type DbxScheduleSelectionCalendarDateDaysForgeFormValue } from './field/selection/calendar.schedule.selection.days.forge.form.component';
import { DbxCalendarScheduleSelectionStore } from './calendar.schedule.selection.store';
import { DbxActionModule } from '@dereekb/dbx-web';
import { DbxActionFormDirective, DbxFormSourceDirective } from '@dereekb/dbx-form';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-days',
  template: `
    <div class="dbx-schedule-selection-calendar-date-days" dbxAction dbxActionAutoTrigger dbxActionEnforceModified [useInstantTriggerPreset]="true" [dbxActionHandler]="updateScheduleDays">
      <dbx-schedule-selection-calendar-date-days-forge-form dbxActionForm [dbxFormSource]="template$" [dbxActionFormIsModified]="isFormModified"></dbx-schedule-selection-calendar-date-days-forge-form>
    </div>
  `,
  imports: [DbxScheduleSelectionCalendarDateDaysForgeFormComponent, DbxFormSourceDirective, DbxActionModule, DbxActionFormDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxScheduleSelectionCalendarDateDaysComponent {
  readonly dbxCalendarStore = inject(DbxCalendarStore);
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly template$: Observable<DbxScheduleSelectionCalendarDateDaysForgeFormValue> = this.dbxCalendarScheduleSelectionStore.scheduleDays$.pipe(map(enabledDaysFromDateCellScheduleDayCodes), shareReplay(1));

  readonly isFormModified: IsModifiedFunction<DbxScheduleSelectionCalendarDateDaysForgeFormValue> = (value: DbxScheduleSelectionCalendarDateDaysForgeFormValue) => {
    const newSetValue = new Set(dateCellScheduleDayCodesFromEnabledDays(value));
    return this.dbxCalendarScheduleSelectionStore.scheduleDays$.pipe(
      map((currentSet) => {
        return !dateCellScheduleDayCodesAreSetsEquivalent(newSetValue, currentSet);
      })
    );
  };

  readonly updateScheduleDays: WorkUsingObservable<DbxScheduleSelectionCalendarDateDaysForgeFormValue> = (value) => {
    this.dbxCalendarScheduleSelectionStore.setScheduleDays(new Set(dateCellScheduleDayCodesFromEnabledDays(value)));
    return of(true);
  };
}
