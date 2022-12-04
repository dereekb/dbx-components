import { Component, EventEmitter, Output } from '@angular/core';
import { isSameMonth } from 'date-fns';
import { CalendarEvent } from 'angular-calendar';
import { DbxCalendarStore } from './calendar.store';
import { map, shareReplay, withLatestFrom } from 'rxjs';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { formatToTimeAndDurationString } from '@dereekb/date';

export interface DbxCalendarEvent<T> {
  event: CalendarEvent<T>;
  action?: string;
}

function timeSubtitleForEvent(event: CalendarEvent): string {
  let subtitle;

  if (event.allDay) {
    subtitle = `(All Day)`;
  } else {
    subtitle = formatToTimeAndDurationString(event.start, event.end ?? new Date());
  }

  return subtitle;
}

@Component({
  selector: 'dbx-calendar',
  templateUrl: './calendar.component.html'
})
export class DbxCalendarComponent<T> {
  @Output()
  clickEvent = new EventEmitter<DbxCalendarEvent<T>>();

  readonly viewDate$ = this.calendarStore.date$;

  readonly events$ = this.calendarStore.visibleEvents$.pipe(
    map((events: CalendarEvent[]) => {
      return events
        .map((event: CalendarEvent) => {
          const subtitle = timeSubtitleForEvent(event);
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
    this.clickEvent.emit({ action, event });
  }

  typeToggleChanged(event: MatButtonToggleChange): void {
    this.calendarStore.setDisplayType(event.value);
  }
}
