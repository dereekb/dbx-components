import { Injectable } from '@angular/core';
import { clampDateToDateRange, type DateRange, dateRangeOverlapsDateRangeFunction, isDateInDateRange, isFullDateRange, isSameDateDay, isSameDateRange } from '@dereekb/date';
import { invertDecision, type Maybe, reduceBooleansWithAndFn } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { type CalendarEvent } from 'angular-calendar';
import { differenceInDays, addDays, endOfDay, endOfMonth, endOfWeek, isSameDay, startOfDay, startOfMonth, startOfWeek, isBefore, isAfter } from 'date-fns';
import { type Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap, combineLatest } from 'rxjs';

export enum CalendarDisplayType {
  MONTH = 'month',
  WEEK = 'week',
  DAY = 'day'
}

export interface CalendarViewDateRange {
  readonly type: CalendarDisplayType;
  readonly start: Date;
  readonly end: Date;
  readonly distance: number;
  /**
   * Whether or not the min navigation date is currently visible. This implies that we're at the minimum date.
   */
  readonly isMinDateVisible: boolean;
  /**
   * Whether or not the maximum navigation date is visible. This implies that we're at the maximum date.
   */
  readonly isMaxDateVisible: boolean;
}

/**
 * Compares two {@link CalendarViewDateRange} values for equality by checking type, start/end dates, distance, and min/max visibility flags.
 *
 * @param a - First calendar view date range to compare.
 * @param b - Second calendar view date range to compare.
 * @returns Whether the two date ranges are considered equal.
 */
export function isCalendarViewDateRangeEqual(a: CalendarViewDateRange, b: CalendarViewDateRange): boolean {
  return a.type === b.type && isSameDay(a.start, b.start) && isSameDay(a.end, b.end) && a.distance === b.distance && a.isMinDateVisible === b.isMinDateVisible && a.isMaxDateVisible === b.isMaxDateVisible;
}

export interface CalendarState<T = any> {
  /**
   * Calendar display mode
   */
  readonly type: CalendarDisplayType;
  /**
   * Whether or not to show the today button. Defaults to true.
   */
  readonly showTodayButton?: boolean;
  /**
   * Date that is selected.
   */
  readonly date: Date;
  /**
   * Whether or not the day was tapped/set twice.
   */
  readonly dateTappedTwice: boolean;
  /**
   * Set of calendar events.
   */
  readonly events: CalendarEvent<T>[];
  /**
   * Optional navigation range limitation that limits which dates can be navigated to.
   */
  readonly navigationRangeLimit?: Maybe<Partial<DateRange>>;
  /**
   * Whether or not to display the page buttons when applicable. Can only be displayed when a navigationRangeLimit is set.
   */
  readonly showPageButtons?: boolean;
}

/**
 * Computes the visible date range for the given calendar state based on display type (month, week, or day)
 * and the optional navigation range limit.
 *
 * @param calendarState - The current calendar state containing display type, date, and navigation limits.
 * @returns The computed visible date range including start, end, distance, and min/max visibility flags.
 */
export function visibleDateRangeForCalendarState(calendarState: CalendarState): CalendarViewDateRange {
  const { navigationRangeLimit, type, date } = calendarState;

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

  const isMinDateVisible: boolean = navigationRangeLimit?.start != null ? !isAfter(start, navigationRangeLimit.start) : false;
  const isMaxDateVisible: boolean = navigationRangeLimit?.end != null ? !isBefore(end, navigationRangeLimit.end) : false;

  // TODO: Consider changing min/max date visible logical utility to be fully within the current month or not,
  // not just visible, since it can change to a locked out calendar and doesn't feel as UI friendly.

  return {
    type,
    start,
    end,
    distance,
    isMinDateVisible,
    isMaxDateVisible
  };
}

const distinctUntilDateOrTypeOrEventsChanged = distinctUntilChanged<CalendarState>((a, b) => a?.date === b?.date && a?.type === b?.type && a?.events === b?.events);

@Injectable()
export class DbxCalendarStore<T = any> extends ComponentStore<CalendarState<T>> {
  constructor() {
    super({
      type: CalendarDisplayType.MONTH,
      showTodayButton: true,
      date: new Date(),
      dateTappedTwice: false,
      events: []
    });
  }

  // MARK: Effects
  readonly tapFirstPage = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.minNavigationDate$.pipe(
          first(),
          tap((x) => {
            if (x) {
              this.tapDay(x);
            }
          })
        )
      )
    );
  });

  readonly tapNext = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.visibleDateRange$.pipe(
          first(),
          tap(({ end, isMaxDateVisible }) => {
            if (!isMaxDateVisible) {
              this.tapDay(addDays(end, 1));
            }
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
          tap(({ start, isMinDateVisible }) => {
            if (!isMinDateVisible) {
              this.tapDay(addDays(start, -1));
            }
          })
        )
      )
    );
  });

  readonly tapLastPage = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.maxNavigationDate$.pipe(
          first(),
          tap((x) => {
            if (x) {
              this.tapDay(x);
            }
          })
        )
      )
    );
  });

  // MARK: Accessors

  readonly showTodayButton$ = this.state$.pipe(
    map((x) => x.showTodayButton),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly date$ = this.state$.pipe(map((x) => x.date));
  readonly dateTappedTwice$ = this.state$.pipe(map((x) => x.dateTappedTwice));

  readonly events$ = this.state$.pipe(
    map((x) => x.events),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * Returns the events that match the tapped date range state.
   */
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

  readonly visibleDateRange$: Observable<CalendarViewDateRange> = this.state$.pipe(map(visibleDateRangeForCalendarState), distinctUntilChanged(isCalendarViewDateRangeEqual), shareReplay(1));

  readonly visibleEvents$ = combineLatest([this.events$, this.visibleDateRange$]).pipe(
    map(([events, dateRange]) => {
      const isEventInDateRange = dateRangeOverlapsDateRangeFunction(dateRange);
      return events.filter((x) => isEventInDateRange(x));
    }),
    shareReplay(1)
  );

  readonly isLookingAtToday$ = this.visibleDateRange$.pipe(
    map((x) => isDateInDateRange(new Date(), x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isLookingAtMinimumDate$ = this.visibleDateRange$.pipe(
    map((x) => x.isMinDateVisible),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isLookingAtMaximumDate$ = this.visibleDateRange$.pipe(
    map((x) => x.isMaxDateVisible),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly hasMultiplePages$ = combineLatest([this.isLookingAtMinimumDate$, this.isLookingAtMaximumDate$]).pipe(map(invertDecision(reduceBooleansWithAndFn(true))), distinctUntilChanged(), shareReplay(1));

  readonly displayType$ = this.state$.pipe(
    map((x) => x.type),
    distinctUntilChanged((a, b) => a === b),
    shareReplay(1)
  );

  readonly navigationRangeLimit$ = this.state$.pipe(
    map((x) => x.navigationRangeLimit),
    distinctUntilChanged(isSameDateRange),
    shareReplay(1)
  );

  readonly minNavigationDate$: Observable<Maybe<Date>> = this.navigationRangeLimit$.pipe(
    map((x) => x?.start),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  readonly maxNavigationDate$: Observable<Maybe<Date>> = this.navigationRangeLimit$.pipe(
    map((x) => x?.end),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  readonly isTodayInNavigationRangeLimit$ = this.navigationRangeLimit$.pipe(
    map((x) => isDateInDateRange(new Date(), x ?? {})),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly canJumpToToday$ = combineLatest([this.isLookingAtToday$, this.isTodayInNavigationRangeLimit$]).pipe(
    map(([isLookingAtToday, isTodayInNavigationRangeLimit]) => !isLookingAtToday && isTodayInNavigationRangeLimit),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly canShowPageButtons$ = this.state$.pipe(
    map((x) => x.showPageButtons && x.navigationRangeLimit && isFullDateRange(x.navigationRangeLimit)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly showPageButtons$ = combineLatest([this.canShowPageButtons$, this.isLookingAtMinimumDate$, this.isLookingAtMaximumDate$]).pipe(
    map(([canShowPageButtons, isLookingAtMinimumDate, isLookingAtMaximumDate]) => {
      return canShowPageButtons && !(isLookingAtMinimumDate && isLookingAtMaximumDate);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  /**
   * Tap a day.
   *
   * - If the same day is presented, dateTappedTwice is flipped.
   */
  readonly tapDay = this.updater((state, date: Date) => updateCalendarStateWithTappedDate(state, date));

  /**
   * Set all events on the calendar.
   */
  readonly setEvents = this.updater((state, events: CalendarEvent<T>[]) => ({ ...state, events }));

  /**
   * Set all events on the calendar.
   */
  readonly setDisplayType = this.updater((state, type: CalendarDisplayType) => ({ ...state, type }));

  /**
   * Sets the navigation limit.
   */
  readonly setNavigationRangeLimit = this.updater((state, navigationRangeLimit: Maybe<Partial<DateRange>>) => updateCalendarStateWithNavigationRangeLimit(state, navigationRangeLimit));

  readonly setShowTodayButton = this.updater((state, showTodayButton: Maybe<boolean>) => ({ ...state, showTodayButton: showTodayButton != null ? showTodayButton : true }));
  readonly setShowPageButtons = this.updater((state, showPageButtons: Maybe<boolean>) => ({ ...state, showPageButtons: showPageButtons != null ? showPageButtons : false }));
}

/**
 * Returns an updated calendar state after tapping a date. Only updates if the date differs from the current one
 * and falls within the navigation range limit. Toggles `dateTappedTwice` when the same day is tapped again.
 *
 * @param state - The current calendar state.
 * @param date - The date that was tapped.
 * @returns The updated calendar state reflecting the tapped date.
 */
export function updateCalendarStateWithTappedDate(state: CalendarState, date: Date) {
  // only update the date if it is different
  if (
    !isSameDateDay(state.date, date) && // Only update the date if it is within the date range
    (!state.navigationRangeLimit || isDateInDateRange(date, state.navigationRangeLimit))
  ) {
    state = { ...state, date, dateTappedTwice: isSameDay(date, state.date) ? !state.dateTappedTwice : false };
  }

  return state;
}

/**
 * Returns an updated calendar state with a new navigation range limit. If the current date falls outside
 * the new range, it is clamped to fit within the limit.
 *
 * @param state - The current calendar state.
 * @param navigationRangeLimit - The new navigation date range limit, or undefined/null to remove the limit.
 * @returns The updated calendar state with the applied navigation range limit.
 */
export function updateCalendarStateWithNavigationRangeLimit(state: CalendarState, navigationRangeLimit: Maybe<Partial<DateRange>>) {
  const { date } = state;

  // cap the date if it doesn't fall within the range.
  if (navigationRangeLimit && !isDateInDateRange(date, navigationRangeLimit)) {
    const clampedDate = clampDateToDateRange(date, navigationRangeLimit);
    return { ...state, date: clampedDate, navigationRangeLimit };
  } else {
    return { ...state, navigationRangeLimit };
  }
}
