import { Injectable } from '@angular/core';
import {
  DateBlockDayOfWeekFactory,
  dateBlockDayOfWeekFactory,
  DateBlockIndex,
  DateBlockRangeWithRange,
  dateBlockTimingDateFactory,
  DateOrDateBlockIndex,
  DateRange,
  dateScheduleDateFilter,
  DateScheduleDateFilterConfig,
  DateScheduleDayCode,
  dateScheduleEncodedWeek,
  DateScheduleEncodedWeek,
  DateScheduleRange,
  DateTimingRelativeIndexFactory,
  dateTimingRelativeIndexFactory,
  expandDateScheduleDayCodesToDayOfWeekSet,
  findMaxDate,
  findMinDate,
  isDateInDateRangeFunction,
  IsDateWithinDateBlockRangeFunction,
  isDateWithinDateBlockRangeFunction,
  isSameDate,
  isSameDateDay,
  isSameDateRange,
  systemBaseDateToNormalDate,
  systemNormalDateToBaseDate
} from '@dereekb/date';
import { filterMaybe } from '@dereekb/rxjs';
import { Maybe, TimezoneString, DecisionFunction, IterableOrValue, iterableToArray, addToSet, toggleInSet, isIndexNumberInIndexRangeFunction, MaybeMap, removeFromSet, excludeValues, minAndMaxNumber, setsAreEquivalent, DayOfWeek, range } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { addYears, startOfDay, startOfYear } from 'date-fns';
import { Observable, distinctUntilChanged, map, shareReplay, filter, share } from 'rxjs';
import { CalendarScheduleSelectionCellContentFactory, CalendarScheduleSelectionValue, defaultCalendarScheduleSelectionCellContentFactory } from './calendar.schedule.selection';

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
   * Minimum date allowed if no filter is set. If a filter is set, the greater of the two dates is used as the minimum.
   */
  minDate?: Maybe<Date>;
  /**
   * Maximum date allowed if no fitler is set. If a filter is set, the lesser of the two dates is used as the maximum.
   */
  maxDate?: Maybe<Date>;
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
   * Set of the days of week that are allowed.
   */
  allowedDaysOfWeek: Set<DayOfWeek>;
  /**
   *
   */
  indexDayOfWeek: DateBlockDayOfWeekFactory;
  /**
   * Decision function that returns true if a value is enabled given the current filter.
   */
  isEnabledFilterDay: DecisionFunction<DateOrDateBlockIndex>;
  /**
   * Decision function that returns true if a value is enabled.
   *
   * This function does not take the current filter into account.
   */
  isEnabledDay: DecisionFunction<DateOrDateBlockIndex>;
  /**
   * CalendarScheduleSelectionCellContentFactory for the view.
   */
  cellContentFactory: CalendarScheduleSelectionCellContentFactory;
}

export function initialCalendarScheduleSelectionState(): CalendarScheduleSelectionState {
  const start = systemBaseDateToNormalDate(startOfDay(new Date()));
  const scheduleDays = new Set([DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND]);
  const allowedDaysOfWeek = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(scheduleDays));
  const indexFactory = dateTimingRelativeIndexFactory({ start });
  const indexDayOfWeek = dateBlockDayOfWeekFactory(start);

  return {
    start,
    indexFactory,
    selectedIndexes: new Set(),
    scheduleDays,
    allowedDaysOfWeek,
    indexDayOfWeek,
    isEnabledFilterDay: () => true,
    isEnabledDay: () => false,
    minDate: new Date(0),
    maxDate: startOfYear(addYears(new Date(), 100)),
    cellContentFactory: defaultCalendarScheduleSelectionCellContentFactory
  };
}

@Injectable()
export class DbxCalendarScheduleSelectionStore extends ComponentStore<CalendarScheduleSelectionState> {
  constructor() {
    super(initialCalendarScheduleSelectionState());
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

  readonly isEnabledFilterDayFunction$: Observable<DecisionFunction<DateOrDateBlockIndex>> = this.state$.pipe(
    map((x) => x.isEnabledFilterDay),
    shareReplay(1)
  );

  readonly isEnabledDayFunction$: Observable<DecisionFunction<DateOrDateBlockIndex>> = this.state$.pipe(
    map((x) => x.isEnabledDay),
    shareReplay(1)
  );

  readonly currentDateRange$: Observable<Maybe<DateRange>> = this.state$.pipe(
    map(computeCalendarScheduleSelectionRange),
    distinctUntilChanged((a, b) => isSameDateRange(a, b)),
    shareReplay(1)
  );

  readonly dateRange$: Observable<DateRange> = this.currentDateRange$.pipe(filterMaybe(), shareReplay(1));

  readonly scheduleDays$: Observable<Set<DateScheduleDayCode>> = this.state$.pipe(
    map((x) => x.scheduleDays),
    distinctUntilChanged(setsAreEquivalent),
    shareReplay(1)
  );

  readonly selectionValue$ = this.state$.pipe(map(computeScheduleSelectionValue), shareReplay(1));

  readonly minDate$ = this.state$.pipe(
    map((x) => findMaxDate([x.filter?.start, x.minDate])),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  readonly maxDate$ = this.state$.pipe(
    map((x) => findMinDate([x.filter?.end, x.maxDate])),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  readonly cellContentFactory$ = this.state$.pipe(
    map((x) => x.cellContentFactory),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setFilter = this.updater((state, filter: Maybe<DateScheduleDateFilterConfig>) => updateStateWithFilter(state, filter));
  readonly clearFilter = this.updater((state) => updateStateWithFilter(state, undefined));

  readonly setTimezone = this.updater((state, timezone: Maybe<TimezoneString>) => ({ ...state, timezone }));
  readonly setInputRange = this.updater((state, range: CalendarScheduleSelectionInputDateRange) => updateStateWithChangedRange(state, range));

  readonly toggleSelectedDates = this.updater((state, toggle: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { toggle }));
  readonly addSelectedDates = this.updater((state, add: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { add }));
  readonly removeSelectedDates = this.updater((state, remove: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { remove }));
  readonly setSelectedDates = this.updater((state, set: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { set }));

  readonly setScheduleDays = this.updater((state, scheduleDays: Iterable<DateScheduleDayCode>) => updateStateWithChangedScheduleDays(state, scheduleDays));
  readonly setAllowAllScheduleDays = this.updater((state) => updateStateWithChangedScheduleDays(state, null));

  readonly setCellContentFactory = this.updater((state, cellContentFactory: CalendarScheduleSelectionCellContentFactory) => ({ ...state, cellContentFactory }));
}

export function updateStateWithFilter(state: CalendarScheduleSelectionState, filter: Maybe<DateScheduleDateFilterConfig>): CalendarScheduleSelectionState {
  let isEnabledFilterDay: Maybe<DecisionFunction<DateOrDateBlockIndex>> = () => true;

  if (filter) {
    isEnabledFilterDay = dateScheduleDateFilter(filter);
  }

  return { ...state, filter, isEnabledFilterDay };
}

export function updateStateWithChangedScheduleDays(state: CalendarScheduleSelectionState, change: Maybe<Iterable<DateScheduleDayCode>>): CalendarScheduleSelectionState {
  const { scheduleDays: currentScheduleDays } = state;
  const scheduleDays = new Set(change || [DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND]);

  if (setsAreEquivalent(currentScheduleDays, scheduleDays)) {
    return state; // no change
  } else {
    const allowedDaysOfWeek = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(scheduleDays));
    const nextState = { ...state, scheduleDays, allowedDaysOfWeek };
    nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);
    return nextState;
  }
}

export interface CalendarScheduleSelectionStateDatesChange {
  toggle?: IterableOrValue<DateOrDateBlockIndex>;
  add?: IterableOrValue<DateOrDateBlockIndex>;
  remove?: IterableOrValue<DateOrDateBlockIndex>;
  set?: IterableOrValue<DateOrDateBlockIndex>;
}

export function updateStateWithChangedDates(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionStateDatesChange): CalendarScheduleSelectionState {
  const { indexFactory, allowedDaysOfWeek, indexDayOfWeek } = state;
  let selectedIndexes: Set<DateBlockIndex>;

  if (change.set) {
    selectedIndexes = new Set(iterableToArray(change.set).map(indexFactory));
  } else {
    selectedIndexes = new Set(state.selectedIndexes);

    if (change.toggle) {
      const allowedToToggle = iterableToArray(change.toggle)
        .map(indexFactory)
        .filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
      toggleInSet(selectedIndexes, allowedToToggle);
    }

    if (change.add) {
      addToSet(selectedIndexes, iterableToArray(change.add).map(indexFactory));
    }

    if (change.remove) {
      addToSet(selectedIndexes, iterableToArray(change.remove).map(indexFactory));
    }
  }

  const nextState = { ...state, selectedIndexes };
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);
  return nextState;
}

export function updateStateWithChangedRange(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionInputDateRange): CalendarScheduleSelectionState {
  const { inputStart: currentInputStart, inputEnd: currentInputEnd, indexFactory, minDate, maxDate } = state;

  const inputStart = startOfDay(change.inputStart);
  const inputEnd = startOfDay(change.inputEnd);

  const isValidRange = minDate != null || maxDate != null ? isDateInDateRangeFunction({ start: minDate ?? undefined, end: maxDate ?? undefined }) : () => true;

  if (!isValidRange(inputStart) || !isValidRange(inputEnd) || (isSameDateDay(inputStart, currentInputStart) && isSameDateDay(inputEnd, currentInputEnd))) {
    return state; // if no change, return the current state.
  }

  const currentIndexes = Array.from(state.selectedIndexes);

  let currentIndexesInRange: DateBlockIndex[] = [];

  if (currentInputStart && currentInputEnd) {
    const currentMinIndex = indexFactory(currentInputStart);
    const currentMaxIndex = indexFactory(currentInputEnd) + 1;

    const isInCurrentRange = isIndexNumberInIndexRangeFunction({ minIndex: currentMinIndex, maxIndex: currentMaxIndex });
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
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);
  return nextState;
}

export function isEnabledDayInCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): DecisionFunction<DateOrDateBlockIndex> {
  const { indexFactory, inputStart, inputEnd, indexDayOfWeek, allowedDaysOfWeek } = state;

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

    const result = isAllowedDayOfWeek && ((isInSelectedRange && !isSelected) || (isSelected && !isInSelectedRange));
    return result;
  };
}

export function computeScheduleSelectionValue(state: CalendarScheduleSelectionState): Maybe<CalendarScheduleSelectionValue> {
  const { indexFactory, inputStart, inputEnd, selectedIndexes, scheduleDays, isEnabledDay, allowedDaysOfWeek, indexDayOfWeek } = state;
  const dateFactory = dateBlockTimingDateFactory(state);
  const dateBlockRange = computeCalendarScheduleSelectionDateBlockRange(state);

  if (dateBlockRange == null) {
    return null; // returns null if no items are selected.
  }

  const start = dateFactory(dateBlockRange.i);
  const end = dateFactory(dateBlockRange.to);

  const indexOffset = dateBlockRange.i;

  const ex: DateBlockIndex[] = range(dateBlockRange.i, dateBlockRange.to + 1)
    .filter((x) => {
      const isExcludedIndex = allowedDaysOfWeek.has(indexDayOfWeek(x)) && !isEnabledDay(x);
      return isExcludedIndex;
    })
    .map((x) => x - indexOffset); // set to the proper offset

  const w: DateScheduleEncodedWeek = dateScheduleEncodedWeek(scheduleDays);
  const d: DateBlockIndex[] = []; // "included" blocks are never used/calculated.

  const dateScheduleRange: DateScheduleRange = {
    start,
    end,
    w,
    d,
    ex
  };

  return {
    dateScheduleRange,
    minMaxRange: { start, end }
  };
}

export function computeCalendarScheduleSelectionRange(state: CalendarScheduleSelectionState): Maybe<DateRange> {
  const dateFactory = dateBlockTimingDateFactory(state);
  const dateBlockRange = computeCalendarScheduleSelectionDateBlockRange(state);

  if (dateBlockRange != null) {
    return { start: dateFactory(dateBlockRange.i), end: dateFactory(dateBlockRange.to as number) };
  } else {
    return undefined;
  }
}

export function computeCalendarScheduleSelectionDateBlockRange(state: CalendarScheduleSelectionState): Maybe<DateBlockRangeWithRange> {
  const { indexFactory, inputStart, inputEnd, allowedDaysOfWeek, indexDayOfWeek, isEnabledDay, isEnabledFilterDay } = state;
  const enabledSelectedIndexes = Array.from(state.selectedIndexes).filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
  const minAndMaxSelectedValues = minAndMaxNumber(enabledSelectedIndexes);

  let startRange: Maybe<DateBlockIndex>;
  let endRange: Maybe<DateBlockIndex>;

  if (minAndMaxSelectedValues) {
    startRange = minAndMaxSelectedValues.min;
    endRange = minAndMaxSelectedValues.max;
  }

  if (inputStart && inputEnd) {
    const inputStartIndex = indexFactory(inputStart);
    const inputEndIndex = indexFactory(inputEnd);

    startRange = startRange != null ? Math.min(inputStartIndex, startRange) : inputStartIndex;
    endRange = endRange != null ? Math.max(inputEndIndex, endRange) : inputEndIndex;
  }

  if (startRange != null && endRange != null) {
    const scanStartIndex = startRange;
    const scanEndIndex = endRange;

    // clear start and end
    startRange = undefined;
    endRange = undefined;

    // if the min is equal to the start index, then we are in the range and need to iterate dates until we find one that is not selected/excluded.
    for (let i = scanStartIndex; i <= scanEndIndex; i += 1) {
      if (isEnabledFilterDay(i) && isEnabledDay(i)) {
        startRange = i;
        break;
      }
    }

    // same with the max
    for (let i = scanEndIndex; i >= scanStartIndex; i -= 1) {
      if (isEnabledFilterDay(i) && isEnabledDay(i)) {
        endRange = i;
        break;
      }
    }
  }

  if (startRange != null && endRange != null) {
    return { i: startRange, to: endRange };
  } else {
    return undefined;
  }
}
