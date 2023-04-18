import { addDays, startOfDay } from 'date-fns';
import { Component } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from '@dereekb/dbx-form/calendar';
import { DateScheduleDateFilterConfig } from '@dereekb/date';

export const DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER: DateScheduleDateFilterConfig = {
  start: startOfDay(new Date()),
  end: addDays(new Date(), 14), // two weeks
  w: '345', // Tues/Weds/Thurs
  ex: [1] // excludes one day
};

@Component({
  selector: 'doc-extension-calendar-schedule-with-filter-example',
  template: `
    <dbx-schedule-selection-calendar></dbx-schedule-selection-calendar>
    <dbx-content-border>
      <p>Selection: {{ calendarSelectionValue$ | async | json }}</p>
    </dbx-content-border>
  `,
  providers: [DbxCalendarScheduleSelectionStore]
})
export class DocExtensionCalendarScheduleSelectionWithFilterComponent {
  readonly calendarSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;

  constructor(readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {
    dbxCalendarScheduleSelectionStore.setFilter(DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER);
  }
}
