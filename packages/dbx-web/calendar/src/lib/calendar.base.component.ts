import { Component } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { DbxCalendarStore } from './calendar.store';
import { combineLatest, map, shareReplay, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { reduceBooleansWithAnd, reduceBooleansWithAndFn } from '@dereekb/util';

@Component({
  selector: 'dbx-calendar-base',
  templateUrl: './calendar.base.component.html'
})
export class DbxCalendarBaseComponent<T> {
  readonly viewDate$ = this.calendarStore.date$;

  readonly showTodayButton$ = this.calendarStore.showTodayButton$;
  readonly canJumpToToday$ = this.calendarStore.canJumpToToday$;

  readonly isLookingAtMinimumDate$ = this.calendarStore.isLookingAtMinimumDate$;
  readonly isLookingAtMaximumDate$ = this.calendarStore.isLookingAtMaximumDate$;
  readonly hasMultiplePages$ = this.calendarStore.hasMultiplePages$;

  readonly showPageButtons$ = this.calendarStore.canShowPageButtons$;

  readonly activeDayIsOpen$ = this.calendarStore.eventsForDateState$.pipe(
    withLatestFrom(this.calendarStore.date$),
    map(([x, date]) => {
      if (x.events.length && isSameMonth(x.date, date)) {
        return !x.dateTappedTwice;
      }

      return false;
    })
  );

  readonly displayType$ = this.calendarStore.displayType$;

  constructor(public readonly calendarStore: DbxCalendarStore<T>) {}

  todayClicked(): void {
    this.calendarStore.tapDay(new Date());
  }

  firstPageButtonClicked(): void {
    this.calendarStore.tapFirstPage();
  }

  nextButtonClicked(): void {
    this.calendarStore.tapNext();
  }

  previousButtonClicked(): void {
    this.calendarStore.tapPrevious();
  }

  lastPageButtonClicked(): void {
    this.calendarStore.tapLastPage();
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
