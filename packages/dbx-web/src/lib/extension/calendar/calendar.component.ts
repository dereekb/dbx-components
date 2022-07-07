import { Component, EventEmitter, Output } from '@angular/core';
import { isSameMonth, format, differenceInMinutes } from 'date-fns';
import { CalendarEvent } from 'angular-calendar';

import { DbxCalendarStore, CalendarDisplayType, CalendarState } from './calendar.store';
import { map, shareReplay, withLatestFrom } from 'rxjs/operators';
import { CalendarUtility } from '.';
import { MatButtonToggleChange } from '@angular/material/button-toggle';

@Component({
  selector: 'dbx-calendar',
  templateUrl: './calendar.component.html'
})
export class DbxCalendarComponent<T> {
  @Output()
  viewEvent = new EventEmitter<CalendarEvent<T>>();

  readonly viewDate$ = this.calendarStore.date$;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(
    map((events: CalendarEvent[]) => {
      return events
        .map((event: CalendarEvent) => {
          const subtitle = CalendarUtility.timeSubtitleForEvent(event);
          let title;

          if (event.allDay) {
            title = event.title + ' ' + subtitle;
          } else {
            title = `${event.title} - ${subtitle}`;
          }

          return {
            ...event,
            title
          };
        })
        .sort((a, b) => {
          return a.start.getTime() - b.start.getTime();
        });
    }),
    shareReplay(1)
  );

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
    this.viewEvent.emit(event);
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
