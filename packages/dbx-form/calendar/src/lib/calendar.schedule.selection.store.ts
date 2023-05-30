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
  copyDateScheduleDateFilterConfig,
  DateScheduleDateFilterConfig,
  DateScheduleDayCode,
  dateScheduleEncodedWeek,
  DateScheduleEncodedWeek,
  DateScheduleRange,
  DateTimingRelativeIndexFactory,
  dateTimingRelativeIndexFactory,
  expandDateScheduleDayCodes,
  expandDateScheduleDayCodesToDayOfWeekSet,
  findMaxDate,
  findMinDate,
  isDateInDateRangeFunction,
  IsDateWithinDateBlockRangeFunction,
  isDateWithinDateBlockRangeFunction,
  isSameDate,
  isSameDateDay,
  isSameDateRange,
  isSameDateScheduleRange,
  DateOrDateRangeOrDateBlockIndexOrDateBlockRange,
  dateTimingRelativeIndexArrayFactory,
  isInfiniteDateRange,
  copyHoursAndMinutesFromDate,
  dateTimezoneUtcNormal,
  DateTimezoneUtcNormalInstance
} from '@dereekb/date';
import { filterMaybe, switchMapToDefault } from '@dereekb/rxjs';
import { Maybe, TimezoneString, DecisionFunction, IterableOrValue, iterableToArray, addToSet, toggleInSet, isIndexNumberInIndexRangeFunction, MaybeMap, minAndMaxNumber, setsAreEquivalent, DayOfWeek, range, AllOrNoneSelection, unique, mergeArrays, ArrayOrValue, objectHasNoKeys } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { addYears, startOfDay, endOfDay, startOfYear, isAfter, isBefore } from 'date-fns';
import { Observable, distinctUntilChanged, map, shareReplay, combineLatest, switchMap, of, tap, first, combineLatestWith } from 'rxjs';
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
   *
   * If filter.start is provided, then the timezone is ignored, if one is present.
   */
  filter?: Maybe<DateScheduleDateFilterConfig>;
  /**
   * Additional exclusions that may not be defined within the filter.
   */
  inputExclusions?: Maybe<ArrayOrValue<DateOrDateRangeOrDateBlockIndexOrDateBlockRange>>;
  /**
   * The computed exclusions given the input exclusions.
   */
  computedExclusions?: Maybe<DateBlockIndex[]>;
  /**
   * The min/max date range. Used for restricting the min/max value. Works with the filter. The greater/lesser of the start/end dates are used if both are provided.
   */
  minMaxDateRange?: Maybe<Partial<DateRange>>;
  /**
   * Start date. Is updated as the inputStart is modified or filter is provided that provides the start date.
   *
   * Defaults to today and the current timezone.
   */
  start: Date;
  /**
   * Timezone to use. OnlyInfluences the output start date.
   */
  timezone?: Maybe<TimezoneString>;
  /**
   * Current timezone normal with the current timezone.
   */
  timezoneNormal?: Maybe<DateTimezoneUtcNormalInstance>;
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
  /**
   * Current selection value.
   */
  currentSelectionValue?: Maybe<CalendarScheduleSelectionValue>;
  /**
   * Whether or not to use the filter as the start and end range instead of optimizing for the current index.
   *
   * Defaults to true.
   */
  computeSelectionResultRelativeToFilter?: Maybe<boolean>;
  /**
   * The initial selection state when the calendar is reset.
   */
  initialSelectionState?: Maybe<AllOrNoneSelection>;
}

export function initialCalendarScheduleSelectionState(): CalendarScheduleSelectionState {
  const scheduleDays = new Set([DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND]);
  const allowedDaysOfWeek = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(scheduleDays));
  const start = startOfDay(new Date());
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
    computeSelectionResultRelativeToFilter: true,
    cellContentFactory: defaultCalendarScheduleSelectionCellContentFactory
  };
}

export function calendarScheduleMinDate(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Maybe<Date> {
  return findMaxDate([x.filter?.start, x.minMaxDateRange?.start]);
}

export function calendarScheduleMaxDate(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Maybe<Date> {
  return findMinDate([x.filter?.end, x.minMaxDateRange?.end]);
}

export function calendarScheduleMinAndMaxDateRange(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Partial<DateRange> {
  return {
    start: calendarScheduleMinDate(x) || undefined,
    end: calendarScheduleMaxDate(x) || undefined
  };
}

export function calendarScheduleStartBeingUsedFromFilter(x: Pick<CalendarScheduleSelectionState, 'filter' | 'computeSelectionResultRelativeToFilter'>) {
  return x.computeSelectionResultRelativeToFilter && x.filter?.start != null;
}

@Injectable()
export class DbxCalendarScheduleSelectionStore extends ComponentStore<CalendarScheduleSelectionState> {
  constructor() {
    super(initialCalendarScheduleSelectionState());
  }

  // MARK:
  readonly toggleSelection = this.effect((input: Observable<void>) => {
    return input.pipe(
      switchMap(() =>
        this.nextToggleSelection$.pipe(
          first(),
          filterMaybe(),
          tap((x) => {
            this.selectAllDates(x);
          })
        )
      )
    );
  });

  // MARK: Accessors
  readonly filter$ = this.state$.pipe(
    map((x) => x.filter),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly minMaxDateRange$ = this.state$.pipe(map(calendarScheduleMinAndMaxDateRange), distinctUntilChanged(isSameDateRange), shareReplay(1));

  readonly minDate$ = this.minMaxDateRange$.pipe(
    map((x) => x?.start),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );
  readonly maxDate$ = this.minMaxDateRange$.pipe(
    map((x) => x?.end),
    distinctUntilChanged(isSameDateDay),
    shareReplay(1)
  );

  readonly hasConfiguredMinMaxRange$ = this.minMaxDateRange$.pipe(
    map((x) => x != null && x.start != null && x.end != null),
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
      if (x.inputStart && x.inputEnd) {
        return x as CalendarScheduleSelectionInputDateRange;
      } else {
        return undefined;
      }
    }),
    shareReplay(1)
  );

  readonly inputRange$: Observable<CalendarScheduleSelectionInputDateRange> = this.currentInputRange$.pipe(filterMaybe(), shareReplay(1));

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

  readonly computeSelectionResultRelativeToFilter$: Observable<Maybe<boolean>> = this.state$.pipe(
    map((x) => x.computeSelectionResultRelativeToFilter),
    shareReplay(1)
  );

  readonly startBeingUsedFromFilter$: Observable<Maybe<boolean>> = this.state$.pipe(
    //
    map(calendarScheduleStartBeingUsedFromFilter),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly dateRange$: Observable<DateRange> = this.currentDateRange$.pipe(filterMaybe(), shareReplay(1));

  readonly scheduleDays$: Observable<Set<DateScheduleDayCode>> = this.state$.pipe(
    map((x) => x.scheduleDays),
    distinctUntilChanged(setsAreEquivalent),
    shareReplay(1)
  );

  readonly effectiveTimezone$: Observable<Maybe<TimezoneString>> = this.state$.pipe(
    map((x) => (!calendarScheduleStartBeingUsedFromFilter(x) && x.timezone ? x.timezone : undefined)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly effectiveTimezoneNormal$ = this.state$.pipe(
    map((x) => (!calendarScheduleStartBeingUsedFromFilter(x) && x.timezoneNormal ? x.timezoneNormal : undefined)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentSelectionValue$ = this.state$.pipe(
    map((x) => x.currentSelectionValue),
    shareReplay(1)
  );

  readonly currentSelectionValueWithTimezone$ = this.currentSelectionValue$.pipe(
    combineLatestWith(this.effectiveTimezoneNormal$),
    map(([x, timezoneNormal]) => {
      if (x && timezoneNormal) {
        x = {
          dateScheduleRange: {
            ...x.dateScheduleRange,
            start: timezoneNormal.targetDateToSystemDate(x.dateScheduleRange.start),
            end: timezoneNormal.targetDateToSystemDate(x.dateScheduleRange.end)
          }
        } as CalendarScheduleSelectionValue;
      }

      return x;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly nextToggleSelection$: Observable<Maybe<AllOrNoneSelection>> = this.hasConfiguredMinMaxRange$.pipe(
    switchMap((hasConfiguredMinMaxRange) => {
      let obs: Observable<Maybe<AllOrNoneSelection>>;

      if (hasConfiguredMinMaxRange) {
        obs = this.currentSelectionValue$.pipe(map((x) => (Boolean(x) ? 'none' : 'all')));
      } else {
        obs = this.currentSelectionValue$.pipe(map((x) => (Boolean(x) ? 'none' : undefined)));
      }

      return obs;
    }),
    shareReplay(1)
  );

  readonly selectionValue$ = this.currentSelectionValueWithTimezone$.pipe(filterMaybe(), shareReplay(1));

  readonly currentDateScheduleRangeValue$ = this.currentSelectionValueWithTimezone$.pipe(
    map((x) => x?.dateScheduleRange),
    distinctUntilChanged(isSameDateScheduleRange),
    shareReplay(1)
  );

  readonly dateScheduleRangeValue$ = this.currentDateScheduleRangeValue$.pipe(filterMaybe(), shareReplay(1));

  readonly cellContentFactory$ = this.state$.pipe(
    map((x) => x.cellContentFactory),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isCustomized$ = this.state$.pipe(
    map((x) => x.selectedIndexes.size > 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setMinMaxDateRange = this.updater((state, filter: Maybe<Partial<DateRange>>) => updateStateWithMinMaxDateRange(state, filter));
  readonly setFilter = this.updater((state, filter: Maybe<DateScheduleDateFilterConfig>) => updateStateWithFilter(state, filter));
  readonly setExclusions = this.updater((state, exclusions: Maybe<ArrayOrValue<DateOrDateRangeOrDateBlockIndexOrDateBlockRange>>) => updateStateWithExclusions(state, exclusions));
  readonly setComputeSelectionResultRelativeToFilter = this.updater((state, computeSelectionResultRelativeToFilter: Maybe<boolean>) => updateStateWithComputeSelectionResultRelativeToFilter(state, computeSelectionResultRelativeToFilter));
  readonly clearFilter = this.updater((state) => updateStateWithFilter(state, undefined));

  readonly setTimezone = this.updater((state, timezone: Maybe<TimezoneString>) => ({ ...state, timezone, timezoneNormal: timezone ? dateTimezoneUtcNormal({ timezone }) : undefined }));
  readonly setInputRange = this.updater((state, range: CalendarScheduleSelectionInputDateRange) => updateStateWithChangedRange(state, range));

  readonly toggleSelectedDates = this.updater((state, toggle: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { toggle }));
  readonly addSelectedDates = this.updater((state, add: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { add }));
  readonly removeSelectedDates = this.updater((state, remove: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { remove }));
  readonly setSelectedDates = this.updater((state, set: IterableOrValue<DateOrDateBlockIndex>) => updateStateWithChangedDates(state, { set }));
  readonly selectAllDates = this.updater((state, selectAll: AllOrNoneSelection = 'all') => updateStateWithChangedDates(state, { selectAll }));
  readonly setInitialSelectionState = this.updater((state, initialSelectionState: Maybe<AllOrNoneSelection>) => updateStateWithInitialSelectionState(state, initialSelectionState));

  readonly setScheduleDays = this.updater((state, scheduleDays: Iterable<DateScheduleDayCode>) => updateStateWithChangedScheduleDays(state, scheduleDays));
  readonly setAllowAllScheduleDays = this.updater((state) => updateStateWithChangedScheduleDays(state, null));

  readonly setDateScheduleRangeValue = this.updater((state, value: Maybe<DateScheduleRange>) => updateStateWithDateScheduleRangeValue(state, value));
  readonly setCellContentFactory = this.updater((state, cellContentFactory: CalendarScheduleSelectionCellContentFactory) => ({ ...state, cellContentFactory }));
}

export function updateStateWithInitialSelectionState(state: CalendarScheduleSelectionState, initialSelectionState: Maybe<AllOrNoneSelection>): CalendarScheduleSelectionState {
  const { selectedIndexes } = state;

  if (selectedIndexes.size === 0 && initialSelectionState === 'all') {
    state = updateStateWithChangedDates(state, { selectAll: initialSelectionState });
  }

  return { ...state, initialSelectionState };
}

export function updateStateWithComputeSelectionResultRelativeToFilter(currentState: CalendarScheduleSelectionState, computeSelectionResultRelativeToFilter: Maybe<boolean>): CalendarScheduleSelectionState {
  let state: CalendarScheduleSelectionState = { ...currentState, computeSelectionResultRelativeToFilter };

  if (Boolean(currentState.computeSelectionResultRelativeToFilter) !== Boolean(computeSelectionResultRelativeToFilter)) {
    state = updateStateWithChangedDates(state, {}); // recalculate if change occurs as it will affect the output value
  }

  return state;
}

export function updateStateWithExclusions(state: CalendarScheduleSelectionState, inputExclusions: Maybe<ArrayOrValue<DateOrDateRangeOrDateBlockIndexOrDateBlockRange>>): CalendarScheduleSelectionState {
  let computedExclusions: Maybe<DateBlockIndex[]>;

  if (inputExclusions) {
    const { indexFactory } = state;
    const indexArrayFactory = dateTimingRelativeIndexArrayFactory(indexFactory);
    computedExclusions = indexArrayFactory(inputExclusions);
  }

  state = { ...state, inputExclusions, computedExclusions };
  return updateStateWithFilter(state, state.filter);
}

export function updateStateWithMinMaxDateRange(state: CalendarScheduleSelectionState, minMaxDateRange: Maybe<Partial<DateRange>>): CalendarScheduleSelectionState {
  state = { ...state };

  if (minMaxDateRange != null && !isInfiniteDateRange(minMaxDateRange)) {
    state.minMaxDateRange = {
      start: minMaxDateRange.start != null ? startOfDay(minMaxDateRange.start) : undefined,
      end: minMaxDateRange.end != null ? endOfDay(minMaxDateRange.end) : undefined
    };
  } else {
    delete state.minMaxDateRange;
  }

  return updateStateWithFilter(state, state.filter);
}

export function updateStateWithFilter(state: CalendarScheduleSelectionState, inputFilter: Maybe<DateScheduleDateFilterConfig>): CalendarScheduleSelectionState {
  const { computedExclusions: exclusions, minMaxDateRange } = state;

  let isEnabledFilterDay: Maybe<DecisionFunction<DateOrDateBlockIndex>> = () => true;
  let filter: Maybe<DateScheduleDateFilterConfig> = null;

  // create the filter using inputFilter, exclusions, and minMaxDateRange
  if (inputFilter || exclusions?.length || minMaxDateRange) {
    let enabledFilter: DateScheduleDateFilterConfig;

    if (inputFilter) {
      filter = copyDateScheduleDateFilterConfig(inputFilter); // copy filter

      if (exclusions?.length) {
        enabledFilter = {
          ...filter,
          ex: unique(mergeArrays([filter.ex, exclusions]))
        };
      } else {
        enabledFilter = filter;
      }
    } else {
      enabledFilter = {
        w: '89',
        ex: exclusions as number[]
      };
    }

    if (minMaxDateRange) {
      enabledFilter.minMaxDateRange = minMaxDateRange;
      enabledFilter.setStartAsMinDate = Boolean(filter?.start) ? true : false; // If a start date is set, then it becomes the floor.
    }

    /**
     * If the input filter has a start date, use that as the relative start to ensure indexes are compared the same,
     * otherwise use the state's start. This is important for the index calculations.
     */
    enabledFilter.start = inputFilter?.start ?? state.start;

    // create the filter
    isEnabledFilterDay = dateScheduleDateFilter(enabledFilter);
  }

  state = { ...state, filter, isEnabledFilterDay };

  // For the same reason as above, use the filter's start date as the relative start if applicable.
  if (filter && filter.start) {
    const start = filter.start;
    state.start = start;
    state.indexFactory = dateTimingRelativeIndexFactory({ start });
    state.indexDayOfWeek = dateBlockDayOfWeekFactory(start);
  }

  // attempt to re-apply the initial selection state once filter is applied
  if (state.initialSelectionState) {
    state = updateStateWithInitialSelectionState(state, state.initialSelectionState);
  }

  // re-calculate the selection given the filter
  const { inputStart, inputEnd } = state;

  if (inputStart && inputEnd) {
    state = updateStateWithChangedRange(state, { inputStart, inputEnd });
  }

  return state;
}

export function updateStateWithDateScheduleRangeValue(state: CalendarScheduleSelectionState, change: Maybe<DateScheduleRange>): CalendarScheduleSelectionState {
  const { timezoneNormal } = state;
  let currentDateScheduleRange = state.currentSelectionValue?.dateScheduleRange;

  if (!calendarScheduleStartBeingUsedFromFilter(state) && timezoneNormal) {
    if (change) {
      change = {
        ...change,
        start: timezoneNormal.systemDateToTargetDate(change.start),
        end: timezoneNormal.systemDateToTargetDate(change.end)
      };
    }

    if (currentDateScheduleRange) {
      currentDateScheduleRange = {
        ...currentDateScheduleRange,
        start: timezoneNormal.targetDateToSystemDate(currentDateScheduleRange.start),
        end: timezoneNormal.targetDateToSystemDate(currentDateScheduleRange.end)
      };
    }
  }

  const isSameValue = isSameDateScheduleRange(currentDateScheduleRange, change);

  if (isSameValue) {
    return state;
  } else {
    if (change != null) {
      const nextState: CalendarScheduleSelectionState = { ...state, inputStart: change.start, inputEnd: change.end, selectedIndexes: new Set(change.ex) };
      return updateStateWithChangedScheduleDays(finalizeNewCalendarScheduleSelectionState(nextState), expandDateScheduleDayCodes(change.w || '89'));
    } else {
      return noSelectionCalendarScheduleSelectionState(state); // clear selection, retain disabled days
    }
  }
}

export function updateStateWithChangedScheduleDays(state: CalendarScheduleSelectionState, change: Maybe<Iterable<DateScheduleDayCode>>): CalendarScheduleSelectionState {
  const { scheduleDays: currentScheduleDays } = state;
  const scheduleDays = new Set(change || [DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND]);

  if (setsAreEquivalent(currentScheduleDays, scheduleDays)) {
    return state; // no change
  } else {
    const allowedDaysOfWeek = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(scheduleDays));
    const nextState = { ...state, scheduleDays, allowedDaysOfWeek };
    return finalizeNewCalendarScheduleSelectionState(nextState);
  }
}

export interface CalendarScheduleSelectionStateDatesChange {
  reset?: true;
  toggle?: IterableOrValue<DateOrDateBlockIndex>;
  add?: IterableOrValue<DateOrDateBlockIndex>;
  remove?: IterableOrValue<DateOrDateBlockIndex>;
  set?: IterableOrValue<DateOrDateBlockIndex>;
  selectAll?: AllOrNoneSelection;
}

export function updateStateWithChangedDates(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionStateDatesChange): CalendarScheduleSelectionState {
  const { indexFactory, allowedDaysOfWeek, indexDayOfWeek, inputStart: currentInputStart, inputEnd: currentInputEnd, minMaxDateRange } = state;
  const { start: minDate, end: maxDate } = calendarScheduleMinAndMaxDateRange(state);
  let inputStart = currentInputStart;
  let inputEnd = currentInputEnd;

  let selectedIndexes: Set<DateBlockIndex>;

  if (change.reset || change.selectAll != null || change.set) {
    let set: Maybe<IterableOrValue<DateOrDateBlockIndex>> = change.set ?? [];
    let selectAll: Maybe<AllOrNoneSelection> = change.reset === true ? state.initialSelectionState : change.selectAll;

    switch (selectAll) {
      case 'all':
        if (minDate != null && maxDate != null) {
          inputStart = minDate;
          inputEnd = maxDate;
          set = [];
        }
        break;
      case 'none':
        inputStart = null;
        inputEnd = null;
        set = [];
        break;
    }

    selectedIndexes = new Set(iterableToArray(set).map(indexFactory));
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

  const nextState = { ...state, inputStart, inputEnd, selectedIndexes };
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);

  // Recalculate the range and simplified to exclusions
  const rangeAndExclusion = computeScheduleSelectionRangeAndExclusion(nextState);

  if (rangeAndExclusion) {
    return finalizeNewCalendarScheduleSelectionState({ ...nextState, selectedIndexes: new Set(rangeAndExclusion.excluded), inputStart: rangeAndExclusion.start, inputEnd: rangeAndExclusion.end });
  } else {
    // no selected days
    return noSelectionCalendarScheduleSelectionState(nextState);
  }
}

export function noSelectionCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): CalendarScheduleSelectionState {
  return finalizeNewCalendarScheduleSelectionState({ ...state, selectedIndexes: new Set(), inputStart: null, inputEnd: null });
}

export function updateStateWithChangedRange(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionInputDateRange): CalendarScheduleSelectionState {
  const { inputStart: currentInputStart, inputEnd: currentInputEnd, indexFactory, minMaxDateRange } = state;
  const { start: minDate, end: maxDate }: Partial<DateRange> = minMaxDateRange ?? {};

  let inputStart: Date = startOfDay(change.inputStart);
  let inputEnd: Date = endOfDay(change.inputEnd);

  const isValidRange = minDate != null || maxDate != null ? isDateInDateRangeFunction({ start: minDate ?? undefined, end: maxDate ?? undefined }) : () => true;

  if (!isValidRange(inputStart) || !isValidRange(inputEnd) || (isSameDateDay(inputStart, currentInputStart) && isSameDateDay(inputEnd, currentInputEnd))) {
    return state; // if no change, return the current state.
  }

  // retain all indexes that are within the new range
  const minIndex = indexFactory(inputStart);
  const maxIndex = indexFactory(inputEnd) + 1;

  const currentIndexes: DateBlockIndex[] = Array.from(state.selectedIndexes);
  const isInCurrentRange = isIndexNumberInIndexRangeFunction({ minIndex, maxIndex });
  const excludedIndexesInNewRange = currentIndexes.filter(isInCurrentRange);
  const selectedIndexes = new Set(excludedIndexesInNewRange);

  const nextState = { ...state, selectedIndexes, inputStart, inputEnd };
  return finalizeNewCalendarScheduleSelectionState(nextState);
}

export function finalizeNewCalendarScheduleSelectionState(nextState: CalendarScheduleSelectionState): CalendarScheduleSelectionState {
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);
  nextState.currentSelectionValue = computeScheduleSelectionValue(nextState);
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
  const { indexFactory, scheduleDays, allowedDaysOfWeek, indexDayOfWeek, computeSelectionResultRelativeToFilter, filter } = state;
  const rangeAndExclusion = computeScheduleSelectionRangeAndExclusion(state);

  if (rangeAndExclusion == null) {
    return null;
  }

  const { start: rangeStart, end: rangeEnd, excluded: allExcluded, dateBlockRange } = rangeAndExclusion;
  let filterOffsetExcludedRange: DateBlockIndex[] = [];
  let indexOffset = dateBlockRange.i;

  let start = rangeStart;
  let end = rangeEnd;

  // If computeSelectionResultRelativeToFilter is true, then we need to offset the values to be relative to that start.
  if (computeSelectionResultRelativeToFilter && filter?.start) {
    start = filter.start;

    if (filter?.end) {
      end = copyHoursAndMinutesFromDate(end, filter.end);
    }

    const filterStartIndexOffset = indexFactory(rangeStart) - indexFactory(start);
    filterOffsetExcludedRange = range(0, filterStartIndexOffset);
    indexOffset = indexOffset - filterStartIndexOffset;
  }

  const excluded = computeSelectionResultRelativeToFilter
    ? allExcluded.filter((x) => {
        const isExcludedIndex = allowedDaysOfWeek.has(indexDayOfWeek(x)); // ???
        return isExcludedIndex;
      })
    : allExcluded;

  const offsetExcluded: DateBlockIndex[] = excluded.map((x) => x - indexOffset); // set to the proper offset

  const ex = [...filterOffsetExcludedRange, ...offsetExcluded];

  const w: DateScheduleEncodedWeek = dateScheduleEncodedWeek(scheduleDays);
  const d: DateBlockIndex[] = []; // "included" blocks are never used/calculated.

  // Always ensure the end is after or equal to the start.
  if (isBefore(end, start)) {
    end = start; // end is start
  }

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

export interface CalendarScheduleSelectionRangeAndExclusion extends DateRange {
  dateBlockRange: DateBlockRangeWithRange;
  excluded: DateBlockIndex[];
}

export function computeScheduleSelectionRangeAndExclusion(state: CalendarScheduleSelectionState): Maybe<CalendarScheduleSelectionRangeAndExclusion> {
  const { isEnabledDay, isEnabledFilterDay } = state;
  const dateFactory = dateBlockTimingDateFactory(state);
  const dateBlockRange = computeCalendarScheduleSelectionDateBlockRange(state);

  if (dateBlockRange == null) {
    return null; // returns null if no items are selected.
  }

  const start = dateFactory(dateBlockRange.i);
  const end = dateFactory(dateBlockRange.to);

  const excluded: DateBlockIndex[] = range(dateBlockRange.i, dateBlockRange.to + 1).filter((x) => {
    const isExcludedIndex = !isEnabledDay(x) || !isEnabledFilterDay(x);
    return isExcludedIndex;
  });

  const result: CalendarScheduleSelectionRangeAndExclusion = {
    dateBlockRange,
    start,
    end,
    excluded
  };

  return result;
}

export function computeCalendarScheduleSelectionRange(state: CalendarScheduleSelectionState): Maybe<DateRange> {
  const dateFactory = dateBlockTimingDateFactory(state);
  const dateBlockRange = computeCalendarScheduleSelectionDateBlockRange(state);
  const dateRange: Maybe<DateRange> = dateBlockRange != null ? { start: dateFactory(dateBlockRange.i), end: dateFactory(dateBlockRange.to as number) } : undefined;
  return dateRange;
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

  if (inputStart != null && inputEnd != null) {
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
