import { Injectable } from '@angular/core';
import { isDateInDateRange } from '@dereekb/date';
import { ComponentStore } from '@ngrx/component-store';
import { CalendarEvent } from 'angular-calendar';
import { differenceInDays, addDays, endOfDay, endOfMonth, endOfWeek, isSameDay, startOfDay, startOfMonth, startOfWeek, isBefore, isAfter } from 'date-fns';
import { Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap } from 'rxjs';

export enum CalendarDisplayType {
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day'
}

export interface CalendarViewDateRange {
  type: CalendarDisplayType;
  start: Date;
  end: Date;
  distance: number;
}

export interface CalendarState<T = any> {
  /**
   * Calendar display mode
   */
  type: CalendarDisplayType;
  /**
   * Date that is selected.
   */
  date: Date;
  /**
   * Whether or not the day was tapped/set twice.
   */
  dateTappedTwice: boolean;
  /**
   * Set of calendar events.
   */
  events: CalendarEvent<T>[];
}

export function visibleDateRangeForCalendarState(calendarState: CalendarState): CalendarViewDateRange {
  const { type, date } = calendarState;
  let start: Date;
  let end: Date;
  let distance: number;

  switch (type) {
    case CalendarDisplayType.MONTH:
      start = startOfDay(startOfWeek(startOfMonth(date), { weekStartsOn: 0 }));
      end = endOfWeek(endOfMonth(date));
      distance = differenceInDays(end, start) + 1;
      break;
    case CalendarDisplayType.WEEK:
      start = startOfWeek(date);
      end = endOfWeek(start);
      distance = 7; // 7 days in a week.
      break;
    case CalendarDisplayType.DAY:
      start = startOfDay(date);
      end = endOfDay(date);
      distance = 1;
      break;
  }

  // console.log('Date range: ', start, end, distance);

  return {
    type,
    start,
    end,
    distance
  };
}

const distinctUntilDateOrTypeOrEventsChanged = distinctUntilChanged<CalendarState>((a, b) => a?.date === b?.date && a?.type === b?.type && a?.events === b?.events);

@Injectable()
export class DbxCalendarStore<T = any> extends ComponentStore<CalendarState<T>> {
  constructor() {
    super({
      type: CalendarDisplayType.MONTH,
      date: new Date(),
      dateTappedTwice: false,
      events: []
    });
  }

  // MARK: Effects
  readonly tapNext = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.visibleDateRange$.pipe(
          first(),
          tap(({ end }) => {
            this.tapDay(addDays(end, 1));
          })
        )
      )
    );
  });

  readonly tapPrevious = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.visibleDateRange$.pipe(
          first(),
          tap(({ start }) => {
            this.tapDay(addDays(start, -1));
          })
        )
      )
    );
  });

  // MARK: Accessors
  readonly date$ = this.state$.pipe(map((x) => x.date));
  readonly dateTappedTwice$ = this.state$.pipe(map((x) => x.dateTappedTwice));

  readonly events$ = this.state$.pipe(map((x) => x.events));

  // TODO: Filter to be events that will only be displayed based on the current calendar.
  readonly visibleEvents$ = this.state$.pipe(
    map((x) => x.events),
    shareReplay(1)
  );

  readonly eventsForDateState$ = this.state$.pipe(
    distinctUntilDateOrTypeOrEventsChanged,
    map((state) => ({
      date: state.date,
      events: state.events.filter((x) => isSameDay(x.start, state.date) || (x.end && isBefore(x.start, state.date) && isAfter(x.end, state.date))),
      dateTappedTwice: state.dateTappedTwice
    })),
    shareReplay(1)
  );

  readonly eventsForDate$ = this.eventsForDateState$.pipe(map((state) => state.events));

  readonly visibleDateRange$ = this.state$.pipe(
    // If the date or type changes, check again.
    distinctUntilChanged((a, b) => a?.date === b?.date && a?.type === b?.type),
    map(visibleDateRangeForCalendarState),
    distinctUntilChanged((a, b) => {
      if (a.type === b.type) {
        return isSameDay(a.start, b.start);
      } else {
        return false; // Type changed, date range changed.
      }
    }),
    shareReplay(1)
  );

  readonly isLookingAtToday$ = this.visibleDateRange$.pipe(
    map((x) => isDateInDateRange(new Date(), { start: x.start, end: x.end })),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly displayType$ = this.state$.pipe(
    map((x) => x.type),
    distinctUntilChanged((a, b) => a === b),
    shareReplay(1)
  );

  // MARK: State Changes
  /**
   * Tap a day.
   *
   * - If the same day is presented, dateTappedTwice is flipped.
   */
  readonly tapDay = this.updater((state, date: Date) => ({ ...state, date, dateTappedTwice: isSameDay(date, state.date) ? !state.dateTappedTwice : false }));

  /**
   * Set all events on the calendar.
   */
  readonly setEvents = this.updater((state, events: CalendarEvent<T>[]) => ({ ...state, events }));

  /**
   * Set all events on the calendar.
   */
  readonly setDisplayType = this.updater((state, type: CalendarDisplayType) => ({ ...state, type }));
}
