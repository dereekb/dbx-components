import { Component, effect, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type DbxCalendarScheduleSelectionStoreSelectionMode, DbxCalendarScheduleSelectionStore, type DbxScheduleSelectionCalendarComponentConfig, DbxScheduleSelectionCalendarComponent, DbxScheduleSelectionCalendarDateDaysComponent, DbxScheduleSelectionCalendarDateDialogButtonComponent, DbxScheduleSelectionCalendarDateRangeComponent } from '@dereekb/dbx-form/calendar';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { DbxContentBorderDirective, DbxContentPitDirective, DbxSubSectionComponent } from '@dereekb/dbx-web';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'doc-extension-calendar-schedule-example',
  template: `
    <dbx-schedule-selection-calendar [config]="config()"></dbx-schedule-selection-calendar>
    <dbx-content-border>
      <dbx-content-pit>
        <p>currentSelectionValue$: {{ currentSelectionValueSignal() | json }}</p>
        <p>currentSelectionValueDateCellDurationSpanExpansion$: {{ currentSelectionValueDateCellDurationSpanExpansionSignal() | json }}</p>
        <p>selectionValueSelectedIndexes$: {{ selectionValueSelectedIndexesSignal() | json }}</p>
        <p>selectionValueSelectedDates$: {{ selectionValueSelectedDatesSignal() | json }}</p>
        <p>selectionValueWithTimezoneDateCellDurationSpanExpansion$: {{ selectionValueWithTimezoneDateCellDurationSpanExpansionSignal() | json }}</p>
      </dbx-content-pit>
    </dbx-content-border>
    @if (!config()) {
      <dbx-subsection header="Selector Components">
        <dbx-subsection header="dbx-schedule-selection-calendar-date-range" hint="Component used to control and set the date range.">
          <dbx-schedule-selection-calendar-date-range [showCustomize]="true">
            <dbx-schedule-selection-calendar-date-dialog-button customizeButton></dbx-schedule-selection-calendar-date-dialog-button>
          </dbx-schedule-selection-calendar-date-range>
        </dbx-subsection>
        <dbx-subsection header="dbx-schedule-selection-calendar-date-days" hint="Component used to pick days in the selection.">
          <dbx-schedule-selection-calendar-date-days></dbx-schedule-selection-calendar-date-days>
        </dbx-subsection>
      </dbx-subsection>
    }
  `,
  providers: [DbxCalendarScheduleSelectionStore],
  standalone: true,
  imports: [DbxScheduleSelectionCalendarComponent, DbxContentBorderDirective, DbxContentPitDirective, DbxSubSectionComponent, DbxScheduleSelectionCalendarDateRangeComponent, DbxScheduleSelectionCalendarDateDialogButtonComponent, DbxScheduleSelectionCalendarDateDaysComponent, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionCalendarScheduleSelectionComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly config = input<Maybe<DbxScheduleSelectionCalendarComponentConfig>>();

  readonly currentSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;
  readonly currentSelectionValueSignal = toSignal(this.currentSelectionValue$, { initialValue: undefined });
  readonly currentSelectionValueDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValueDateCellDurationSpanExpansion$;
  readonly currentSelectionValueDateCellDurationSpanExpansionSignal = toSignal(this.currentSelectionValueDateCellDurationSpanExpansion$, { initialValue: undefined });
  readonly selectionValueSelectedIndexes$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(map((x) => Array.from(x)));
  readonly selectionValueSelectedIndexesSignal = toSignal(this.selectionValueSelectedIndexes$, { initialValue: undefined });
  readonly selectionValueSelectedDates$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedDates$.pipe(map((x) => Array.from(x)));
  readonly selectionValueSelectedDatesSignal = toSignal(this.selectionValueSelectedDates$, { initialValue: undefined });
  readonly selectionValueWithTimezoneDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.selectionValueWithTimezoneDateCellDurationSpanExpansion$;
  readonly selectionValueWithTimezoneDateCellDurationSpanExpansionSignal = toSignal(this.selectionValueWithTimezoneDateCellDurationSpanExpansion$, { initialValue: undefined });

  readonly selectionMode = input<DbxCalendarScheduleSelectionStoreSelectionMode>();

  protected readonly _selectionModeEffect = effect(() => {
    const mode = this.selectionMode();
    if (mode) {
      this.dbxCalendarScheduleSelectionStore.setSelectionMode(mode);
    }
  });
}
