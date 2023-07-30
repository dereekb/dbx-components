import { Component } from '@angular/core';

@Component({
  selector: 'dbx-schedule-selection-calendar-date-popover-content',
  template: `
    <dbx-content-container padding="min" topPadding="normal">
      <dbx-schedule-selection-calendar-date-range [openPickerOnTextClick]="false"></dbx-schedule-selection-calendar-date-range>
      <dbx-label-block header="Allowed Days Of Week">
        <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
      </dbx-label-block>
    </dbx-content-container>
  `
})
export class DbxScheduleSelectionCalendarDatePopoverContentComponent {}
