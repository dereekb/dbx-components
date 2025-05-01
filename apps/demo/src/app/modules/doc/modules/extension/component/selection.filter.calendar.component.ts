import { addDays, startOfDay } from 'date-fns';
import { Component, inject } from '@angular/core';
import { DbxCalendarScheduleSelectionStore, DbxScheduleSelectionCalendarComponentConfig } from '@dereekb/dbx-form/calendar';
import { DateCellScheduleDateFilterConfig, dateCellTiming, formatToISO8601DayStringForSystem, readDaysOfWeekNames } from '@dereekb/date';
import { DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent } from './example.calendar.schedule.selection.popover.button.component';
import { map } from 'rxjs';
import { daysOfWeekNameFunction, isEvenNumber, isOddNumber, randomNumberFactory, range, sortNumbersAscendingFunction } from '@dereekb/util';
import { DbxScheduleSelectionCalendarComponent } from '../../../../../../../../../packages/dbx-form/calendar/src/lib/calendar.schedule.selection.component';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';
import { DbxContentPitDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.pit.directive';
import { AsyncPipe, JsonPipe } from '@angular/common';

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
      <div>
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
        <p>Days: {{ selectedDaysOfWeek$ | async }}</p>
        <p>currentSelectionValue$: {{ currentSelectionValue$ | async | json }}</p>
        <p>currentSelectionValueDateCellDurationSpanExpansion$: {{ currentSelectionValueDateCellDurationSpanExpansion$ | async | json }}</p>
        <p>selectionValueSelectedIndexes$: {{ selectionValueSelectedIndexes$ | async | json }}</p>
        <p>selectionValueSelectedDates$: {{ selectionValueSelectedDates$ | async | json }}</p>
        <p>selectionValueWithTimezoneDateCellDurationSpanExpansion$: {{ selectionValueWithTimezoneDateCellDurationSpanExpansion$ | async | json }}</p>
        <p>Output Timezone: {{ outputTimezone$ | async }}</p>
      </dbx-content-pit>
    </dbx-content-border>
  `,
    providers: [DbxCalendarScheduleSelectionStore],
    standalone: true,
    imports: [DbxScheduleSelectionCalendarComponent, DbxContentBorderDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxContentPitDirective, AsyncPipe, JsonPipe]
})
export class DocExtensionCalendarScheduleSelectionWithFilterComponent {
  readonly dbxCalendarScheduleSelectionStore = inject(DbxCalendarScheduleSelectionStore);

  readonly config: DbxScheduleSelectionCalendarComponentConfig = {
    buttonInjectionConfig: {
      componentClass: DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent
    }
  };

  readonly outputTimezone$ = this.dbxCalendarScheduleSelectionStore.outputTimezone$;
  readonly currentSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;
  readonly currentSelectionValueDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValueDateCellDurationSpanExpansion$;
  readonly selectionValueSelectedIndexes$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(map((x) => Array.from(x)));
  readonly selectionValueSelectedDates$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedDates$.pipe(map((x) => Array.from(x)));
  readonly selectionValueWithTimezoneDateCellDurationSpanExpansion$ = this.dbxCalendarScheduleSelectionStore.selectionValueWithTimezoneDateCellDurationSpanExpansion$;
  readonly selectedDaysOfWeek$ = this.currentSelectionValueDateCellDurationSpanExpansion$.pipe(map((x) => readDaysOfWeekNames(x, (y) => y.startsAt, daysOfWeekNameFunction({ abbreviation: true }))));

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
