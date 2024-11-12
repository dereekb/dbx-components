import { Component, EventEmitter, Output, OnDestroy, inject } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { CalendarEvent } from 'angular-calendar';
import { DbxCalendarStore } from './calendar.store';
import { distinctUntilChanged, map, shareReplay, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { DbxCalendarEvent, prepareAndSortCalendarEvents } from './calendar';

@Component({
  selector: 'dbx-calendar',
  templateUrl: './calendar.component.html'
})
export class DbxCalendarComponent<T> implements OnDestroy {
  readonly calendarStore = inject(DbxCalendarStore<T>);

  @Output()
  readonly clickEvent = new EventEmitter<DbxCalendarEvent<T>>();

  readonly viewDate$ = this.calendarStore.date$;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(map(prepareAndSortCalendarEvents), shareReplay(1));

  readonly activeDayIsOpen$ = this.calendarStore.eventsForDateState$.pipe(
    withLatestFrom(this.calendarStore.date$),
    map(([x, date]) => {
      if (x.events.length && isSameMonth(x.date, date)) {
        return !x.dateTappedTwice;
      }

      return false;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly displayType$ = this.calendarStore.displayType$;

  ngOnDestroy(): void {
    this.clickEvent.complete();
  }

  todayClicked(): void {
    this.dayClicked({ date: new Date() });
  }

  nextButtonClicked(): void {
    this.calendarStore.tapNext();
  }

  previousButtonClicked(): void {
    this.calendarStore.tapPrevious();
  }

  dayClicked({ date }: { date: Date }): void {
    this.calendarStore.tapDay(date);
  }

  eventClicked(action: string, event: CalendarEvent<T>): void {
    this.clickEvent.emit({ action, event });
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
