import { Component } from '@angular/core';
import { DbxScheduleSelectionCalendarDateDaysComponent } from '../../../../../../../../../packages/dbx-form/calendar/src/lib/calendar.schedule.selection.days.component';

@Component({
    selector: 'doc-example-schedule-selection-calendar-date-popover-content',
    template: `
    <div>
      <p>Custom Content</p>
      <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
    </div>
  `,
    standalone: true,
    imports: [DbxScheduleSelectionCalendarDateDaysComponent]
})
export class DocExtensionExampleScheduleSelectionCalendarDatePopoverContentComponent {}
