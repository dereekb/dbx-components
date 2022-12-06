import { Injectable } from '@angular/core';
import {
  dateBlockDayOfWeekFactory,
  DateBlockIndex,
  dateBlockTimingDateFactory,
  DateOrDateBlockIndex,
  DateRange,
  DateSchedule,
  DateScheduleDateFilterConfig,
  DateScheduleDayCode,
  DateScheduleRange,
  DateTimingRelativeIndexFactory,
  dateTimingRelativeIndexFactory,
  expandDateScheduleDayCodesToDayOfWeekSet,
  findMaxDate,
  findMinDate,
  isDateInDateRangeFunction,
  IsDateWithinDateBlockRangeFunction,
  isDateWithinDateBlockRangeFunction,
  IsDateWithinDateBlockRangeInput,
  isSameDate,
  isSameDateDay,
  isSameDateRange
} from '@dereekb/date';
import { filterMaybe, tapLog } from '@dereekb/rxjs';
import { ArrayOrValue, addToSetCopy, Maybe, TimezoneString, DecisionFunction, IterableOrValue, iterableToArray, addToSet, toggleInSet, isIndexRangeInIndexRangeFunction, isIndexNumberInIndexRangeFunction, MaybeMap, removeFromSet, symmetricDifferenceArray, excludeValuesFromSet, excludeValues, minAndMaxNumber, setsAreEquivalent } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { CalendarEvent } from 'angular-calendar';
import { differenceInDays, addDays, endOfDay, endOfMonth, endOfWeek, isSameDay, startOfDay, startOfMonth, startOfWeek, isBefore, isAfter } from 'date-fns';
import { symmetricDifference } from 'extra-set';
import { start } from 'repl';
import { Observable, distinctUntilChanged, first, map, shareReplay, switchMap, tap, filter } from 'rxjs';
import { CalendarScheduleSelectionValue } from './calendar.schedule.selection';

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
   * DateTimingRelativeIndexFactory
   */
  indexFactory: DateTimingRelativeIndexFactory;
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
  scheduleDays: Set<DateScheduleDayCode>;
  /**
   * Decision function that returns true if a value is selected.
   */
  isSelectedDay: DecisionFunction<DateOrDateBlockIndex>;
}

function initialState(): CalendarScheduleSelectionState {
  const start = startOfDay(new Date());

  return {
    start,
    indexFactory: dateTimingRelativeIndexFactory({ start }),
    selectedIndexes: new Set(),
    isSelectedDay: () => false,
    scheduleDays: new Set([DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND])
  };
}

@Injectable()
export class DbxCalendarScheduleSelectionStore extends ComponentStore<CalendarScheduleSelectionState> {
  constructor() {
    super(initialState());
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

  readonly currentMinAndMaxDate$: Observable<Maybe<DateRange>> = this.state$.pipe(
    map(computeCalendarScheduleSelectionRange),
    distinctUntilChanged((a, b) => isSameDateRange(a, b)),
    shareReplay(1)
  );

  readonly minAndMaxDate$: Observable<DateRange> = this.currentMinAndMaxDate$.pipe(filterMaybe(), shareReplay(1));

  readonly scheduleDays$: Observable<Set<DateScheduleDayCode>> = this.state$.pipe(
    map((x) => x.scheduleDays),
    distinctUntilChanged(setsAreEquivalent),
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

  readonly setScheduleDays = this.updater((state, scheduleDays: Iterable<DateScheduleDayCode>) => updateStateWithChangedScheduleDays(state, scheduleDays));
  readonly setAllowAllScheduleDays = this.updater((state) => updateStateWithChangedScheduleDays(state, null));
}

export interface CalendarScheduleSelectionStateDatesChange {
  toggle?: IterableOrValue<DateOrDateBlockIndex>;
  add?: IterableOrValue<DateOrDateBlockIndex>;
  remove?: IterableOrValue<DateOrDateBlockIndex>;
  set?: IterableOrValue<DateOrDateBlockIndex>;
}

export function updateStateWithChangedScheduleDays(state: CalendarScheduleSelectionState, change: Maybe<Iterable<DateScheduleDayCode>>): CalendarScheduleSelectionState {
  const { scheduleDays: currentScheduleDays } = state;
  const scheduleDays = new Set(change || [DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND]);

  if (setsAreEquivalent(currentScheduleDays, scheduleDays)) {
    return state; // no change
  } else {
    const nextState = { ...state, scheduleDays };
    nextState.isSelectedDay = isSelectedDayInCalendarScheduleSelectionState(nextState);
    return nextState;
  }
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

  // TODO: Only allow adding/toggling on dates that have the days enabled, in order to prevent invisible changes.

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
  const inOldRangeButNotInNewRange = excludeValues(currentIndexesInNewRange, currentIndexesInRange);

  // set new selected indexes
  const selectedIndexes = new Set(state.selectedIndexes);
  addToSet(selectedIndexes, currentIndexesInRange); // retain exclusions
  removeFromSet(selectedIndexes, inOldRangeButNotInNewRange); // clear items not in both

  const nextState = { ...state, indexFactory, selectedIndexes, inputStart: inputStart, inputEnd: inputEnd };
  nextState.isSelectedDay = isSelectedDayInCalendarScheduleSelectionState(nextState);
  return nextState;
}

export function isSelectedDayInCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): DecisionFunction<DateOrDateBlockIndex> {
  const { inputStart, inputEnd, scheduleDays, start } = state;
  const indexFactory = dateTimingRelativeIndexFactory(state);
  const allowedDaysOfWeek = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(scheduleDays));

  const indexDayOfWeek = dateBlockDayOfWeekFactory(start);
  let isInStartAndEndRange: IsDateWithinDateBlockRangeFunction;

  if (inputStart && inputEnd) {
    isInStartAndEndRange = isDateWithinDateBlockRangeFunction({ start: state.start, range: { start: inputStart, end: inputEnd } });
  } else {
    isInStartAndEndRange = () => false;
  }

  return (input: DateOrDateBlockIndex) => {
    const index = indexFactory(input);
    const dayOfWeek = indexDayOfWeek(index);

    const isInSelectedRange = isInStartAndEndRange(input);
    const isSelected = state.selectedIndexes.has(index);
    const isAllowedDayOfWeek = allowedDaysOfWeek.has(dayOfWeek);
    return isAllowedDayOfWeek && ((isInSelectedRange && !isSelected) || (isSelected && !isInSelectedRange));
  };
}

export function computeCalendarScheduleSelectionRange(state: CalendarScheduleSelectionState): Maybe<DateRange> {
  const { start, indexFactory, inputStart, inputEnd, selectedIndexes, scheduleDays } = state;
  const allowedDaysOfWeek = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(scheduleDays));
  const indexDayOfWeek = dateBlockDayOfWeekFactory(start);
  const dateFactory = dateBlockTimingDateFactory(state);
  const enabledSelectedIndexes = Array.from(state.selectedIndexes).filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
  const minAndMaxSelectedValues = minAndMaxNumber(enabledSelectedIndexes);

  let minSelectedValueDate: Maybe<Date>;
  let maxSelectedValueDate: Maybe<Date>;

  let startRange: Maybe<Date>;
  let endRange: Maybe<Date>;

  if (minAndMaxSelectedValues) {
    minSelectedValueDate = dateFactory(minAndMaxSelectedValues.min);
    maxSelectedValueDate = dateFactory(minAndMaxSelectedValues.max);
  }

  if (inputStart && inputEnd) {
    startRange = inputStart;
    endRange = inputEnd;

    const startIndex = indexFactory(startRange);
    const endIndex = indexFactory(endRange);

    // if the min is equal to the start index, then we are in the range and need to iterate dates until we find one that is not selected/excluded.
    startRange = undefined;
    minSelectedValueDate = undefined;

    for (let i = startIndex; i <= endIndex; i += 1) {
      const isExcluded = selectedIndexes.has(i);

      if (!isExcluded && allowedDaysOfWeek.has(indexDayOfWeek(i))) {
        startRange = dateFactory(i);
        break;
      }
    }

    // same with the max
    endRange = undefined;
    maxSelectedValueDate = undefined;

    for (let i = endIndex; i > startIndex; i -= 1) {
      const isExcluded = selectedIndexes.has(i);

      if (!isExcluded && allowedDaysOfWeek.has(indexDayOfWeek(i))) {
        endRange = dateFactory(i);
        break;
      }
    }
  }

  const minDate = findMinDate([startRange, minSelectedValueDate]);
  const maxDate = findMaxDate([endRange, maxSelectedValueDate]);

  if (minDate ?? maxDate) {
    return { start: minDate ?? (maxDate as Date), end: maxDate ?? (minDate as Date) };
  } else {
    return undefined;
  }
}

export function computeScheduleSelectionValue(state: CalendarScheduleSelectionState): Maybe<CalendarScheduleSelectionValue> {
  const { inputStart, inputEnd, scheduleDays, start } = state;
  const minMaxRange = computeCalendarScheduleSelectionRange(state);

  // the start is then offset to begin at the minimum date.

  return undefined;
}
