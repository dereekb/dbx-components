import { Component, inject } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { DbxCalendarStore } from './calendar.store';
import { map, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';

@Component({
  selector: 'dbx-calendar-base',
  templateUrl: './calendar.base.component.html'
})
export class DbxCalendarBaseComponent<T> {
  readonly calendarStore = inject(DbxCalendarStore<T>);

  readonly viewDate$ = this.calendarStore.date$;

  readonly showTodayButton$ = this.calendarStore.showTodayButton$;
  readonly canJumpToToday$ = this.calendarStore.canJumpToToday$;

  readonly isLookingAtMinimumDate$ = this.calendarStore.isLookingAtMinimumDate$;
  readonly isLookingAtMaximumDate$ = this.calendarStore.isLookingAtMaximumDate$;
  readonly hasMultiplePages$ = this.calendarStore.hasMultiplePages$;

  readonly showPageButtons$ = this.calendarStore.showPageButtons$;

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
