import { Injectable } from '@angular/core';
import { DateBlockIndex, DateOrDateBlockIndex, DateSchedule, DateScheduleDateFilterConfig, DateScheduleDayCode, isSameDate } from '@dereekb/date';
import { tapLog } from '@dereekb/rxjs';
import { addToSetCopy, Maybe, TimezoneString } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { CalendarEvent } from 'angular-calendar';
import { differenceInDays, addDays, endOfDay, endOfMonth, endOfWeek, isSameDay, startOfDay, startOfMonth, startOfWeek, isBefore, isAfter } from 'date-fns';
import { Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap } from 'rxjs';

export interface CalendarScheduleSelectionInputDateRange {
  /**
   * Input Start Date
   */
  inputStart?: Maybe<Date>;
  /**
   * Input End Date
   */
  inputEnd?: Maybe<Date>;
}

export interface CalendarScheduleSelectionState extends CalendarScheduleSelectionInputDateRange {
  /**
   * Filters the days of the schedule to only allow selecting days in the schedule.
   */
  filter?: Maybe<DateScheduleDateFilterConfig>;
  /**
   * Optional timezone string.
   *
   * If not defined, defaults to the current timezone.
   *
   * When set will update the start Date.
   */
  timezone?: Maybe<TimezoneString>;
  /**
   * Start date. Is updated as the inputStart is modified or filter is provided that provides the start date.
   *
   * Defaults to today and the current timezone.
   */
  start: Date;
  /**
   * Array of manually selected dates.
   *
   * Values that exist outside of the "input" range are considered toggled on, while those
   * that are selected within the range are considered toggled off.
   *
   * If dates are selected, and then a range is selected, then those dates within the range that fall
   * within the range are cleared from selection.
   *
   * These indexes are relative to the start date.
   */
  selectedDates: Set<DateBlockIndex>;
  /**
   * Days of the schedule that are allowed to be picked.
   */
  scheduleDays?: Set<DateScheduleDayCode>;
}

@Injectable()
export class DbxCalendarScheduleSelectionStore extends ComponentStore<CalendarScheduleSelectionState> {
  constructor() {
    super({
      start: startOfDay(new Date()),
      inputStart: new Date(),
      selectedDates: new Set()
    });
  }

  // MARK: Accessors
  readonly filter$ = this.state$.pipe(
    map((x) => x.filter),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly inputStart$ = this.state$.pipe(
    map((x) => x.inputStart),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );
  readonly inputEnd$ = this.state$.pipe(
    map((x) => x.inputEnd),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly inputStartAndEnd$: Observable<CalendarScheduleSelectionInputDateRange> = this.state$.pipe(
    map(({ inputStart, inputEnd }) => ({ inputStart, inputEnd })),
    distinctUntilChanged((a, b) => isSameDate(a.inputStart, b.inputStart) && isSameDate(a.inputEnd, b.inputEnd)),
    shareReplay(1)
  );

  readonly selectedDates$: Observable<Set<DateBlockIndex>> = this.state$.pipe(
    map((x) => x.selectedDates),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setFilter = this.updater((state, filter: Maybe<DateScheduleDateFilterConfig>) => ({ ...state, filter }));

  /**
   * Set or clears the  DateScheduleDateFilterConfig
   */
  readonly clearFilter = this.updater((state) => ({ ...state, filter: undefined }));

  readonly setTimezone = this.updater((state, timezone: Maybe<TimezoneString>) => ({ ...state, timezone }));
  readonly setInputStartDate = this.updater((state, inputStart: Maybe<Date>) => ({ ...state, inputStart })); // TODO: Filter selectedDates based on the input range.
  readonly setInputEndDate = this.updater((state, inputEnd: Maybe<Date>) => ({ ...state, inputEnd })); // TODO: Filter selectedDates based on the input range.
  readonly setInputRange = this.updater((state, { inputStart, inputEnd }: CalendarScheduleSelectionInputDateRange) => ({ ...state, inputStart, inputEnd })); // TODO: Filter selectedDates based on the input range.

  readonly addSelectedDates = this.updater((state, datesToAdd: DateOrDateBlockIndex) => ({ ...state, selectedDate: addToSetCopy(state.selectedDates, datesToAdd) })); // TODO: Filter selectedDates based on the input range.
  readonly setSelectedDates = this.updater((state, selectedDates: Set<DateBlockIndex>) => ({ ...state, selectedDates })); // TODO: Filter selectedDates based on the input range.

  readonly setScheduleDays = this.updater((state, scheduleDays: Set<DateScheduleDayCode>) => ({ ...state, scheduleDays }));
}
