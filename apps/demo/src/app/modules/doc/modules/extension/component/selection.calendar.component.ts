import { Component } from '@angular/core';
import { DbxCalendarScheduleSelectionStore } from '@dereekb/dbx-form/calendar';

@Component({
  selector: 'doc-extension-calendar-schedule-example',
  template: `
    <dbx-schedule-selection-calendar></dbx-schedule-selection-calendar>
    <dbx-content-border>
      <p>Selection: {{ calendarSelectionValue$ | async | json }}</p>
    </dbx-content-border>
    <dbx-subsection header="Selector Components">
      <dbx-subsection header="dbx-schedule-selection-calendar-date-range" hint="Component used to control and set the date range.">
        <dbx-schedule-selection-calendar-date-range [showCustomize]="true"></dbx-schedule-selection-calendar-date-range>
      </dbx-subsection>
      <dbx-subsection header="dbx-schedule-selection-calendar-date-days" hint="Component used to pick days in the selection.">
        <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
      </dbx-subsection>
    </dbx-subsection>
  `,
  providers: [DbxCalendarScheduleSelectionStore]
})
export class DocExtensionCalendarScheduleSelectionComponent {
  readonly calendarSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;

  constructor(readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}
}
