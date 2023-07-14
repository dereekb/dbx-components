import { Component, Input } from '@angular/core';
import { DbxCalendarScheduleSelectionStore, DbxScheduleSelectionCalendarComponentConfig } from '@dereekb/dbx-form/calendar';
import { Maybe } from '@dereekb/util';
import { map } from 'rxjs';

@Component({
  selector: 'doc-extension-calendar-schedule-example',
  template: `
    <dbx-schedule-selection-calendar [config]="config"></dbx-schedule-selection-calendar>
    <dbx-content-border>
      <dbx-content-pit>
        <p>currentSelectionValue$: {{ currentSelectionValue$ | async | json }}</p>
        <p>currentSelectionValueDateBlockDurationSpan$: {{ currentSelectionValueDateBlockDurationSpan$ | async | json }}</p>
        <p>selectionValueSelectedIndexes$: {{ selectionValueSelectedIndexes$ | async | json }}</p>
        <p>selectionValueSelectedDates$: {{ selectionValueSelectedDates$ | async | json }}</p>
        <p>selectionValueWithTimezoneDateBlockDurationSpan$: {{ selectionValueWithTimezoneDateBlockDurationSpan$ | async | json }}</p>
      </dbx-content-pit>
    </dbx-content-border>
    <dbx-subsection *ngIf="!config" header="Selector Components">
      <dbx-subsection header="dbx-schedule-selection-calendar-date-range" hint="Component used to control and set the date range.">
        <dbx-schedule-selection-calendar-date-range [showCustomize]="true">
          <dbx-schedule-selection-calendar-date-dialog-button customizeButton></dbx-schedule-selection-calendar-date-dialog-button>
        </dbx-schedule-selection-calendar-date-range>
      </dbx-subsection>
      <dbx-subsection header="dbx-schedule-selection-calendar-date-days" hint="Component used to pick days in the selection.">
        <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
      </dbx-subsection>
    </dbx-subsection>
  `,
  providers: [DbxCalendarScheduleSelectionStore]
})
export class DocExtensionCalendarScheduleSelectionComponent {
  @Input()
  config?: Maybe<DbxScheduleSelectionCalendarComponentConfig>;

  readonly currentSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;
  readonly currentSelectionValueDateBlockDurationSpan$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValueDateBlockDurationSpan$;
  readonly selectionValueSelectedIndexes$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(map((x) => Array.from(x)));
  readonly selectionValueSelectedDates$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedDates$.pipe(map((x) => Array.from(x)));
  readonly selectionValueWithTimezoneDateBlockDurationSpan$ = this.dbxCalendarScheduleSelectionStore.selectionValueWithTimezoneDateBlockDurationSpan$;

  constructor(readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {}
}
