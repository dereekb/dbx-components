import { Injectable } from '@angular/core';
import { DateBlockIndex, DateOrDateBlockIndex, DateSchedule, DateScheduleDateFilterConfig, DateScheduleDayCode, dateTimingRelativeIndexFactory, isDateInDateRangeFunction, IsDateWithinDateBlockRangeFunction, isDateWithinDateBlockRangeFunction, IsDateWithinDateBlockRangeInput, isSameDate, isSameDateDay } from '@dereekb/date';
import { tapLog } from '@dereekb/rxjs';
import { ArrayOrValue, addToSetCopy, Maybe, TimezoneString, DecisionFunction, IterableOrValue, iterableToArray, addToSet, toggleInSet, isIndexRangeInIndexRangeFunction, isIndexNumberInIndexRangeFunction, MaybeMap, removeFromSet, symmetricDifferenceArray, excludeValuesFromSet, excludeValues } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { CalendarEvent } from 'angular-calendar';
import { differenceInDays, addDays, endOfDay, endOfMonth, endOfWeek, isSameDay, startOfDay, startOfMonth, startOfWeek, isBefore, isAfter } from 'date-fns';
import { symmetricDifference } from 'extra-set';
import { start } from 'repl';
import { Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap, filter } from 'rxjs';

export interface CalendarScheduleSelectionInputDateRange {
  /**
   * Input Start Date
   */
  inputStart: Date;
  /**
   * Input End Date
   */
  inputEnd: Date;
}

export type PartialCalendarScheduleSelectionInputDateRange = Partial<MaybeMap<CalendarScheduleSelectionInputDateRange>>;

export interface CalendarScheduleSelectionState extends PartialCalendarScheduleSelectionInputDateRange {
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
  selectedIndexes: Set<DateBlockIndex>;
  /**
   * Days of the schedule that are allowed to be picked.
   */
  scheduleDays?: Set<DateScheduleDayCode>;
  /**
   * Decision function that returns true if a value is selected.
   */
  isSelectedDay: DecisionFunction<DateOrDateBlockIndex>;
}

@Injectable()
export class DbxCalendarScheduleSelectionStore extends ComponentStore<CalendarScheduleSelectionState> {
  constructor() {
    super({
      start: startOfDay(new Date()),
      inputStart: new Date(),
      selectedIndexes: new Set(),
      isSelectedDay: () => false
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

  readonly currentInputRange$: Observable<Maybe<CalendarScheduleSelectionInputDateRange>> = this.state$.pipe(
    map(({ inputStart, inputEnd }) => ({ inputStart, inputEnd })),
    distinctUntilChanged((a, b) => isSameDate(a.inputStart, b.inputStart) && isSameDate(a.inputEnd, b.inputEnd)),
    map((x) => {
      if (Boolean(x.inputStart && x.inputEnd)) {
        return x as CalendarScheduleSelectionInputDateRange;
      } else {
        return undefined;
      }
    }),
    shareReplay(1)
  );

  readonly inputRange$: Observable<CalendarScheduleSelectionInputDateRange> = this.currentInputRange$.pipe(
    //
    filter(Boolean),
    shareReplay(1)
  );

  readonly selectedDates$: Observable<Set<DateBlockIndex>> = this.state$.pipe(
    map((x) => x.selectedIndexes),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isSelectedDayFunction$: Observable<DecisionFunction<DateOrDateBlockIndex>> = this.state$.pipe(
    map((x) => x.isSelectedDay),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setFilter = this.updater((state, filter: Maybe<DateScheduleDateFilterConfig>) => ({ ...state, filter }));

  /**
   * Set or clears the  DateScheduleDateFilterConfig
   */
  readonly clearFilter = this.updater((state) => ({ ...state, filter: undefined }));

  readonly setTimezone = this.updater((state, timezone: Maybe<TimezoneString>) => ({ ...state, timezone }));
  readonly setInputRange = this.updater((state, range: CalendarScheduleSelectionInputDateRange) => updateStateWithChangedRange(state, range));

  readonly toggleSelectedDates = this.updater((state, toggle: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { toggle }));
  readonly addSelectedDates = this.updater((state, add: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { add }));
  readonly removeSelectedDates = this.updater((state, remove: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { remove }));
  readonly setSelectedDates = this.updater((state, set: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { set }));

  readonly setScheduleDays = this.updater((state, scheduleDays: Set<DateScheduleDayCode>) => ({ ...state, scheduleDays }));
}

export interface CalendarScheduleSelectionStateDatesChange {
  toggle?: IterableOrValue<DateOrDateBlockIndex>;
  add?: IterableOrValue<DateOrDateBlockIndex>;
  remove?: IterableOrValue<DateOrDateBlockIndex>;
  set?: IterableOrValue<DateOrDateBlockIndex>;
}

export function updateStateWithChangedDates(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionStateDatesChange): CalendarScheduleSelectionState {
  const indexFactory = dateTimingRelativeIndexFactory(state);
  let selectedIndexes: Set<DateBlockIndex>;

  if (change.set) {
    selectedIndexes = new Set(iterableToArray(change.set).map(indexFactory));
  } else {
    selectedIndexes = new Set(state.selectedIndexes);

    if (change.toggle) {
      toggleInSet(selectedIndexes, iterableToArray(change.toggle).map(indexFactory));
    }

    if (change.add) {
      addToSet(selectedIndexes, iterableToArray(change.add).map(indexFactory));
    }

    if (change.remove) {
      addToSet(selectedIndexes, iterableToArray(change.remove).map(indexFactory));
    }
  }

  const nextState = { ...state, selectedIndexes };
  nextState.isSelectedDay = isSelectedDayInCalendarScheduleSelectionState(nextState);
  return nextState;
}

export function updateStateWithChangedRange(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionInputDateRange): CalendarScheduleSelectionState {
  const { inputStart: currentInputStart, inputEnd: currentInputEnd } = state;

  const inputStart = startOfDay(change.inputStart);
  const inputEnd = startOfDay(change.inputEnd);

  if (isSameDateDay(inputStart, currentInputStart) && isSameDateDay(inputEnd, currentInputEnd)) {
    return state; // if no change, return the current state.
  }

  const indexFactory = dateTimingRelativeIndexFactory(state);
  const currentIndexes = Array.from(state.selectedIndexes);

  let currentIndexesInRange: DateBlockIndex[] = [];

  if (currentInputStart && currentInputEnd) {
    const minIndex = indexFactory(currentInputStart);
    const maxIndex = indexFactory(currentInputEnd) + 1;

    const isInCurrentRange = isIndexNumberInIndexRangeFunction({ minIndex, maxIndex });
    currentIndexesInRange = currentIndexes.filter(isInCurrentRange);
  }

  // exclude all indexes that are within the new range
  const minIndex = indexFactory(inputStart);
  const maxIndex = indexFactory(inputEnd) + 1;

  const isInCurrentRange = isIndexNumberInIndexRangeFunction({ minIndex, maxIndex });
  const currentIndexesInNewRange = currentIndexes.filter(isInCurrentRange);

  // exclude all items that are within the old range and not in the new range
  const inOldRangeButNotInNewRange = excludeValues(currentIndexesInRange, currentIndexesInNewRange);

  // set new selected indexes
  const selectedIndexes = new Set(state.selectedIndexes);
  addToSet(selectedIndexes, currentIndexesInRange); // retain exclusions
  removeFromSet(selectedIndexes, inOldRangeButNotInNewRange); // clear items not in both

  console.log({ selectedIndexes, currentIndexesInNewRange, currentIndexesInRange });

  const nextState = { ...state, selectedIndexes, inputStart: inputStart, inputEnd: inputEnd };
  nextState.isSelectedDay = isSelectedDayInCalendarScheduleSelectionState(nextState);
  return nextState;
}

export function isSelectedDayInCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): DecisionFunction<DateOrDateBlockIndex> {
  const { inputStart, inputEnd } = state;
  const indexFactory = dateTimingRelativeIndexFactory(state);

  let isInStartAndEndRange: IsDateWithinDateBlockRangeFunction;

  if (inputStart && inputEnd) {
    isInStartAndEndRange = isDateWithinDateBlockRangeFunction({ start: state.start, range: { start: inputStart, end: inputEnd } });
  } else {
    isInStartAndEndRange = () => false;
  }

  return (input: DateOrDateBlockIndex) => {
    const index = indexFactory(input);

    const isInSelectedRange = isInStartAndEndRange(input);
    const isSelected = state.selectedIndexes.has(index);

    return (isInSelectedRange && !isSelected) || (isSelected && !isInSelectedRange);
  };
}
