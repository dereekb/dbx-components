import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { combineLatestWith, delay, map, of, type Observable } from 'rxjs';
import { DbxCalendarScheduleSelectionStore, DbxScheduleSelectionCalendarComponent, DbxScheduleSelectionCalendarDateRangeComponent, type DbxScheduleSelectionCalendarComponentConfig, type DbxScheduleSelectionCalendarBeforeMonthViewRenderModifyDayFunction, type CalendarScheduleSelectionMetadata } from '@dereekb/dbx-form/calendar';
import { type DateCellIndex, type DateCellScheduleDateFilterConfig, type DateCellScheduleEncodedWeek } from '@dereekb/date';
import { DbxCalendarStore } from '@dereekb/dbx-web/calendar';
import { DbxContentContainerDirective, DbxContentBorderDirective, DbxContentPitDirective, DbxButtonComponent, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

const TIMEZONE = 'America/Chicago';

const FILTER_START = new Date('2026-04-16T05:00:00.000Z');
const FILTER_STARTS_AT = new Date('2026-04-16T13:30:00.000Z');
const FILTER_END = new Date('2026-05-28T21:30:00.000Z');

// Mirrors `nextIncompleteJobStartDate$` in the real app, which returns a Monday (5/4)
// when the next incomplete job starts on a Monday. With this minMaxDateRange.start,
// `dateScheduleRange.start` ends up at 5/4 — 18 days after filter.start (4/16).
const MIN_DATE_MONDAY = new Date('2026-05-04T05:00:00.000Z');
// Alternate "today = 5/1" scenario the user reported: offset becomes 15 days.
const MIN_DATE_TODAY = new Date('2026-05-01T05:00:00.000Z');

const FILTER: DateCellScheduleDateFilterConfig = {
  start: FILTER_START,
  startsAt: FILTER_STARTS_AT,
  end: FILTER_END,
  timezone: TIMEZONE,
  w: '8' as DateCellScheduleEncodedWeek,
  d: [],
  ex: []
};

// Mirrors `applicationDateCellIndexes$` in the real app — every weekday from filter.start (4/16)
// through filter.end (5/28) anchored to filter.start (state-relative coordinates).
const APPLICATION_SELECTED_INDEXES: number[] = [0, 1, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 32, 33, 34, 35, 36, 39, 40, 41, 42];

@Component({
  templateUrl: './calendar.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentBorderDirective, DbxContentPitDirective, DbxButtonComponent, DbxButtonSpacerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxScheduleSelectionCalendarComponent, DbxScheduleSelectionCalendarDateRangeComponent, JsonPipe],
  providers: [DbxCalendarStore, DbxCalendarScheduleSelectionStore],
  styles: [
    `
      :host ::ng-deep .doc-bugs-phantom-marker {
        outline: 2px dashed #e91e63;
        outline-offset: -2px;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocBugsCalendarComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly filterDescription = JSON.stringify(
    {
      start: FILTER.start,
      startsAt: FILTER.startsAt,
      end: FILTER.end,
      timezone: FILTER.timezone,
      w: FILTER.w
    },
    null,
    2
  );

  readonly minMaxDescription = JSON.stringify({ start: MIN_DATE_MONDAY }, null, 2);

  // Mirror the real consumer's pattern: read selectionValueSelectedIndexes$ (output-anchored)
  // and use it from a customizeDay function which receives meta.i (state-anchored).
  // This is the call site that exposes the bug as a visible phantom-day annotation.
  private readonly _bugCustomizeDay$: Observable<DbxScheduleSelectionCalendarBeforeMonthViewRenderModifyDayFunction> = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(
    map((selectedIndexesFromStore) => {
      return ((day) => {
        const meta = day.meta as CalendarScheduleSelectionMetadata | undefined;
        if (meta == null) return;
        const stateIndex = meta.i as DateCellIndex;
        // BUG: selectedIndexesFromStore is anchored to dateScheduleRange.start (the OUTPUT start).
        // meta.i is anchored to state.start (= filter.start). They don't match — pink ring lights up
        // on the WRONG cells when minMaxDateRange shifts the output anchor.
        if (selectedIndexesFromStore.has(stateIndex)) {
          day.cssClass = `${day.cssClass ?? ''} doc-bugs-phantom-marker`.trim();
        }
      }) as DbxScheduleSelectionCalendarBeforeMonthViewRenderModifyDayFunction;
    })
  );

  readonly config: DbxScheduleSelectionCalendarComponentConfig = {
    customizeDay: this._bugCustomizeDay$
  };

  readonly currentSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;
  readonly currentSelectionValueSignal = toSignal(this.currentSelectionValue$, { initialValue: undefined });

  readonly currentDateCellScheduleRangeValue$ = this.dbxCalendarScheduleSelectionStore.currentDateCellScheduleRangeValue$;
  readonly currentDateCellScheduleRangeValueSignal = toSignal(this.currentDateCellScheduleRangeValue$, { initialValue: undefined });

  readonly currentSelectionValueDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValueDateCellDurationSpanExpansion$;
  readonly currentSelectionValueDateCellDurationSpanExpansionSignal = toSignal(this.currentSelectionValueDateCellDurationSpanExpansion$, { initialValue: undefined });

  readonly selectionValueSelectedIndexes$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(map((x) => Array.from(x).sort((a, b) => a - b)));
  readonly selectionValueSelectedIndexesSignal = toSignal(this.selectionValueSelectedIndexes$, { initialValue: undefined });

  readonly selectionValueSelectedDates$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedDates$.pipe(map((x) => Array.from(x).sort()));
  readonly selectionValueSelectedDatesSignal = toSignal(this.selectionValueSelectedDates$, { initialValue: undefined });

  readonly toggledIndexes$ = this.dbxCalendarScheduleSelectionStore.state$.pipe(map((x) => Array.from(x.toggledIndexes).sort((a, b) => a - b)));
  readonly toggledIndexesSignal = toSignal(this.toggledIndexes$, { initialValue: undefined });

  readonly inputRange$ = this.dbxCalendarScheduleSelectionStore.currentInputRange$;
  readonly inputRangeSignal = toSignal(this.inputRange$, { initialValue: undefined });

  // Compare: dates from output indexes interpreted via state's indexFactory (BUGGY consumer pattern)
  // vs. the dates the store actually intends are selected.
  readonly buggyConsumerInterpretation$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(
    combineLatestWith(this.dbxCalendarScheduleSelectionStore.state$),
    map(([outputIndexes, state]) => {
      // The state's indexFactory is anchored at state.start (filter.start = 4/16).
      // A consumer that reads "selectionValueSelectedIndexes" and treats them as state-anchored
      // would compute these dates:
      const dateFactory = state.indexFactory._timing ? (i: number) => new Date((state.start as Date).getTime() + i * 24 * 60 * 60 * 1000) : (i: number) => new Date(i);
      return Array.from(outputIndexes)
        .sort((a, b) => a - b)
        .map((i) => dateFactory(i).toISOString().slice(0, 10));
    })
  );
  readonly buggyConsumerInterpretationSignal = toSignal(this.buggyConsumerInterpretation$, { initialValue: undefined });

  constructor() {
    // Mirrors job.worker.apply.component.ts ngOnInit() flow:
    //   setFilter → setMinMaxDateRange → setInitialSelectionState('all') → setSelectedIndexes (delayed 50ms).
    this.dbxCalendarScheduleSelectionStore.setFilter(FILTER);
    this.dbxCalendarScheduleSelectionStore.setMinMaxDateRange({ start: MIN_DATE_MONDAY });
    this.dbxCalendarScheduleSelectionStore.setInitialSelectionState('all');
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(of(APPLICATION_SELECTED_INDEXES).pipe(delay(50)));
  }

  applyAllWeekdaySelectedIndexes() {
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(APPLICATION_SELECTED_INDEXES);
  }

  useMonMinDate() {
    this.dbxCalendarScheduleSelectionStore.setMinMaxDateRange({ start: MIN_DATE_MONDAY });
  }

  useTodayMinDate() {
    this.dbxCalendarScheduleSelectionStore.setMinMaxDateRange({ start: MIN_DATE_TODAY });
  }

  removeMinMaxDateRange() {
    this.dbxCalendarScheduleSelectionStore.setMinMaxDateRange(undefined);
  }

  toggleStateIndex36() {
    this.dbxCalendarScheduleSelectionStore.toggleSelectedDates([36]);
  }

  toggleDate522() {
    this.dbxCalendarScheduleSelectionStore.toggleSelectedDates([new Date('2026-05-22T05:00:00.000Z')]);
  }

  selectAll() {
    this.dbxCalendarScheduleSelectionStore.selectAllDates('all');
  }

  selectNone() {
    this.dbxCalendarScheduleSelectionStore.selectAllDates('none');
  }
}
