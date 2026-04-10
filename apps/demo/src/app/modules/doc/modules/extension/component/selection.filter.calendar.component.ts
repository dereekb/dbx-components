import { addDays, startOfDay } from 'date-fns';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxCalendarScheduleSelectionStore, type DbxScheduleSelectionCalendarComponentConfig, DbxScheduleSelectionCalendarComponent } from '@dereekb/dbx-form/calendar';
import { type DateCellScheduleDateFilterConfig, dateCellTiming, formatToISO8601DayStringForSystem, readDaysOfWeekNames } from '@dereekb/date';
import { DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent } from './example.calendar.schedule.selection.popover.button.component';
import { map } from 'rxjs';
import { daysOfWeekNameFunction, isEvenNumber, isOddNumber, randomNumberFactory, range, sortNumbersAscendingFunction } from '@dereekb/util';
import { DbxContentBorderDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxContentPitDirective } from '@dereekb/dbx-web';
import { JsonPipe } from '@angular/common';

const daysRangeInFilter = 14;

export const DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER: DateCellScheduleDateFilterConfig = {
  ...dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, daysRangeInFilter, 'UTC'),
  w: '345', // Tues/Weds/Thurs
  ex: [1] // excludes the second day
};

@Component({
  selector: 'doc-extension-calendar-schedule-with-filter-example',
  template: `
    <dbx-schedule-selection-calendar [config]="config"></dbx-schedule-selection-calendar>
    <dbx-content-border>
      <div class="dbx-button-wrap-group">
        <dbx-button [raised]="true" icon="shuffle" text="Random Selection" (buttonClick)="setRandomSelection()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [raised]="true" icon="looks_two" text="Set Even Selection" (buttonClick)="setEvenSelection()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [raised]="true" icon="looks_one" text="Set Odd Selection" (buttonClick)="setOddSelection()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [raised]="true" text="Set First Five Dates" (buttonClick)="setFirstFiveSelection()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [raised]="true" text="Set First Eight Days" (buttonClick)="setFirstEightSelectionWithDays()"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button [raised]="true" text="Set No Days" (buttonClick)="setNoDays()"></dbx-button>
      </div>
      <dbx-content-pit>
        <p>Days: {{ selectedDaysOfWeekSignal() }}</p>
        <p>currentSelectionValue$: {{ currentSelectionValueSignal() | json }}</p>
        <p>currentSelectionValueDateCellDurationSpanExpansion$: {{ currentSelectionValueDateCellDurationSpanExpansionSignal() | json }}</p>
        <p>selectionValueSelectedIndexes$: {{ selectionValueSelectedIndexesSignal() | json }}</p>
        <p>selectionValueSelectedDates$: {{ selectionValueSelectedDatesSignal() | json }}</p>
        <p>selectionValueWithTimezoneDateCellDurationSpanExpansion$: {{ selectionValueWithTimezoneDateCellDurationSpanExpansionSignal() | json }}</p>
        <p>Output Timezone: {{ outputTimezoneSignal() }}</p>
      </dbx-content-pit>
    </dbx-content-border>
  `,
  providers: [DbxCalendarScheduleSelectionStore],
  standalone: true,
  imports: [DbxScheduleSelectionCalendarComponent, DbxContentBorderDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxContentPitDirective, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionCalendarScheduleSelectionWithFilterComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly config: DbxScheduleSelectionCalendarComponentConfig = {
    buttonInjectionConfig: {
      componentClass: DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent
    }
  };

  readonly outputTimezone$ = this.dbxCalendarScheduleSelectionStore.outputTimezone$;
  readonly outputTimezoneSignal = toSignal(this.outputTimezone$, { initialValue: undefined });
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
  readonly selectedDaysOfWeek$ = this.currentSelectionValueDateCellDurationSpanExpansion$.pipe(map((x) => readDaysOfWeekNames(x, (y) => y.startsAt, daysOfWeekNameFunction({ abbreviation: true }))));
  readonly selectedDaysOfWeekSignal = toSignal(this.selectedDaysOfWeek$, { initialValue: undefined });

  constructor() {
    this.dbxCalendarScheduleSelectionStore.setFilter(DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER);
    this.dbxCalendarScheduleSelectionStore.setMinMaxDateRange({ start: addDays(startOfDay(new Date()), 4) });
    this.dbxCalendarScheduleSelectionStore.setInitialSelectionState('all');
  }

  setEvenSelection() {
    const evenIndexes = new Set(range(daysRangeInFilter).filter(isEvenNumber));
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(evenIndexes);
  }

  setOddSelection() {
    const oddIndexes = new Set(range(daysRangeInFilter).filter(isOddNumber));
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(oddIndexes);
  }

  setFirstFiveSelection() {
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes([0, 1, 2, 3, 4]);
  }

  setFirstEightSelectionWithDays() {
    const dayStrings = range(0, 8).map((x) => formatToISO8601DayStringForSystem(addDays(DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER.startsAt as Date, x)));
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(dayStrings);
  }

  setNoDays() {
    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes([]);
  }

  setRandomSelection() {
    const randoms = randomNumberFactory(daysRangeInFilter, 'floor');
    const randomIndexes = new Set(range(daysRangeInFilter / 2).map(randoms));

    console.log('Random indexes: ', Array.from(randomIndexes).sort(sortNumbersAscendingFunction));

    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(randomIndexes);
  }
}
