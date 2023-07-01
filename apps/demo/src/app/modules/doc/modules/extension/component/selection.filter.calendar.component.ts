import { addDays, startOfDay } from 'date-fns';
import { Component } from '@angular/core';
import { DbxCalendarScheduleSelectionStore, DbxScheduleSelectionCalendarComponentConfig } from '@dereekb/dbx-form/calendar';
import { DateScheduleDateFilterConfig, readDaysOfWeekNames } from '@dereekb/date';
import { DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent } from './example.calendar.schedule.selection.popover.button.component';
import { map } from 'rxjs';
import { daysOfWeekNameFunction, isEvenNumber, isOddNumber, randomNumberFactory, range, sortNumbersAscendingFunction } from '@dereekb/util';

const daysRangeInFilter = 14;

export const DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER: DateScheduleDateFilterConfig = {
  start: startOfDay(new Date()),
  end: addDays(new Date(), daysRangeInFilter - 1), // two weeks
  w: '345', // Tues/Weds/Thurs
  ex: [1] // excludes one day
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
        <dbx-button [raised]="true" text="Set First Three Dates" (buttonClick)="setFirstFiveSelection()"></dbx-button>
      </div>
      <dbx-content-pit>
        <p>Days: {{ selectedDaysOfWeek$ | async }}</p>
        <p>currentSelectionValue$: {{ currentSelectionValue$ | async | json }}</p>
        <p>currentSelectionValueDateBlockDurationSpan$: {{ currentSelectionValueDateBlockDurationSpan$ | async | json }}</p>
        <p>selectionValueSelectedIndexes$: {{ selectionValueSelectedIndexes$ | async | json }}</p>
        <p>selectionValueWithTimezoneDateBlockDurationSpan$: {{ selectionValueWithTimezoneDateBlockDurationSpan$ | async | json }}</p>
      </dbx-content-pit>
    </dbx-content-border>
  `,
  providers: [DbxCalendarScheduleSelectionStore]
})
export class DocExtensionCalendarScheduleSelectionWithFilterComponent {
  readonly config: DbxScheduleSelectionCalendarComponentConfig = {
    buttonInjectionConfig: {
      componentClass: DocExtensionExampleScheduleSelectionCalendarDatePopoverButtonComponent
    }
  };

  readonly currentSelectionValue$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValue$;
  readonly currentSelectionValueDateBlockDurationSpan$ = this.dbxCalendarScheduleSelectionStore.currentSelectionValueDateBlockDurationSpan$;
  readonly selectionValueSelectedIndexes$ = this.dbxCalendarScheduleSelectionStore.selectionValueSelectedIndexes$.pipe(map((x) => Array.from(x)));
  readonly selectionValueWithTimezoneDateBlockDurationSpan$ = this.dbxCalendarScheduleSelectionStore.selectionValueWithTimezoneDateBlockDurationSpan$;
  readonly selectedDaysOfWeek$ = this.currentSelectionValueDateBlockDurationSpan$.pipe(map((x) => readDaysOfWeekNames(x, (y) => y.startsAt, daysOfWeekNameFunction({ abbreviation: true }))));

  constructor(readonly dbxCalendarScheduleSelectionStore: DbxCalendarScheduleSelectionStore) {
    dbxCalendarScheduleSelectionStore.setFilter(DOC_EXTENSION_CALENDAR_SCHEDULE_TEST_FILTER);
    dbxCalendarScheduleSelectionStore.setInitialSelectionState('all');
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

  setRandomSelection() {
    const randoms = randomNumberFactory(daysRangeInFilter, 'floor');
    const randomIndexes = new Set(range(daysRangeInFilter / 2).map(randoms));

    console.log('Random indexes: ', Array.from(randomIndexes).sort(sortNumbersAscendingFunction));

    this.dbxCalendarScheduleSelectionStore.setSelectedIndexes(randomIndexes);
  }
}
