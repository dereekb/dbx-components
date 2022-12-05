import { Component, EventEmitter, Output, OnDestroy } from '@angular/core';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-content',
  template: `
    <div>
      <dbx-schedule-selection-calendar-date-range></dbx-schedule-selection-calendar-date-range>
      <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
    </div>
  `
})
export class DbxScheduleSelectionCalendarDatePopoverContentComponent implements OnDestroy {
  ngOnDestroy(): void {}
}
