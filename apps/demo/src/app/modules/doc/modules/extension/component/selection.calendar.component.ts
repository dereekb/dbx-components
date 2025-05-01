import { Component, Input, inject } from '@angular/core';
import { DbxCalendarScheduleSelectionStoreSelectionMode, DbxCalendarScheduleSelectionStore, DbxScheduleSelectionCalendarComponentConfig, DbxScheduleSelectionCalendarComponent, DbxScheduleSelectionCalendarDateDaysComponent, DbxScheduleSelectionCalendarDateDialogButtonComponent, DbxScheduleSelectionCalendarDateRangeComponent } from '@dereekb/dbx-form/calendar';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DbxContentPitDirective } from '@dereekb/dbx-web';
import { NgIf, AsyncPipe, JsonPipe } from '@angular/common';
import { DbxSubSectionComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'doc-extension-calendar-schedule-example',
  template: `
    <dbx-schedule-selection-calendar [config]="config"></dbx-schedule-selection-calendar>
    <dbx-content-border>
      <dbx-content-pit>
        <p>currentSelectionValue$: {{ currentSelectionValue$ | async | json }}</p>
        <p>currentSelectionValueDateCellDurationSpanExpansion$: {{ currentSelectionValueDateCellDurationSpanExpansion$ | async | json }}</p>
        <p>selectionValueSelectedIndexes$: {{ selectionValueSelectedIndexes$ | async | json }}</p>
        <p>selectionValueSelectedDates$: {{ selectionValueSelectedDates$ | async | json }}</p>
        <p>selectionValueWithTimezoneDateCellDurationSpanExpansion$: {{ selectionValueWithTimezoneDateCellDurationSpanExpansion$ | async | json }}</p>
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
  providers: [DbxCalendarScheduleSelectionStore],
  standalone: true,
  imports: [DbxScheduleSelectionCalendarComponent, DbxContentBorderDirective, DbxContentPitDirective, NgIf, DbxSubSectionComponent, DbxScheduleSelectionCalendarDateRangeComponent, DbxScheduleSelectionCalendarDateDialogButtonComponent, DbxScheduleSelectionCalendarDateDaysComponent, AsyncPipe, JsonPipe]
})
export class DocExtensionCalendarScheduleSelectionComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  @Input()
  config?: Maybe<DbxScheduleSelectionCalendarComponentConfig>;

  readonly currentSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;
  readonly currentSelectionValueDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValueDateCellDurationSpanExpansion$;
  readonly selectionValueSelectedIndexes$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(map((x) => Array.from(x)));
  readonly selectionValueSelectedDates$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedDates$.pipe(map((x) => Array.from(x)));
  readonly selectionValueWithTimezoneDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.selectionValueWithTimezoneDateCellDurationSpanExpansion$;

  @Input()
  set selectionMode(selectionMode: DbxCalendarScheduleSelectionStoreSelectionMode) {
    this.dbxCalendarScheduleSelectionStore.setSelectionMode(selectionMode);
  }
}
