import { Component } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { DbxCalendarStore } from './calendar.store';
import { map, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';

@Component({
  selector: 'dbx-calendar-base',
  templateUrl: './calendar.base.component.html'
})
export class DbxCalendarBaseComponent<T> {
  readonly viewDate$ = this.calendarStore.date$;

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

  nextButtonClicked(): void {
    this.calendarStore.tapNext();
  }

  previousButtonClicked(): void {
    this.calendarStore.tapPrevious();
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
