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
  DateTimezoneUtcNormalInstance,
  expandDateScheduleRange,
  DateBlock,
  DateBlockDurationSpan,
  formatToISO8601DayString,
  DateTimingRelativeIndexFactoryInput
} from '@dereekb/date';
import { distinctUntilHasDifferentValues, filterMaybe } from '@dereekb/rxjs';
import { Maybe, TimezoneString, DecisionFunction, IterableOrValue, iterableToArray, addToSet, toggleInSet, isIndexNumberInIndexRangeFunction, MaybeMap, minAndMaxNumber, setsAreEquivalent, DayOfWeek, range, AllOrNoneSelection, unique, mergeArrays, ArrayOrValue, removeFromSet, ISO8601DayString, filterValuesToSet, mapValuesToSet } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { startOfDay, endOfDay, isBefore } from 'date-fns';
import { Observable, distinctUntilChanged, map, shareReplay, switchMap, tap, first, combineLatestWith, of } from 'rxjs';
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
   * Readonly state of the view.
   *
   * Does not affect state changes directly, but instead acts as a flag for the parent view to set and the consuming views to update on.
   */
  isViewReadonly?: Maybe<boolean>;
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
   * Array of manually selected dates within the picked range. This is NOT the set of all selected indexes in terms of output.
   *
   * Values that exist outside of the "input" range are considered toggled on, while those
   * that are selected within the range are considered toggled off.
   *
   * If dates are selected, and then a range is selected, then those dates within the range that fall
   * within the range are cleared from selection.
   *
   * These indexes are relative to the start date.
   */
  toggledIndexes: Set<DateBlockIndex>;
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
  isEnabledFilterDay: DecisionFunction<DateTimingRelativeIndexFactoryInput>;
  /**
   * Decision function that returns true if a value is enabled.
   *
   * This function does not take the current filter into account.
   */
  isEnabledDay: DecisionFunction<DateTimingRelativeIndexFactoryInput>;
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
    toggledIndexes: new Set(),
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

  /**
   * @deprecated This is not the same as the current selection value. This is the set of manually togged off dates. It will be removed in a future update.
   */
  readonly selectedDates$: Observable<Set<DateBlockIndex>> = this.state$.pipe(
    map((x) => x.toggledIndexes),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isEnabledFilterDayFunction$: Observable<DecisionFunction<DateTimingRelativeIndexFactoryInput>> = this.state$.pipe(
    map((x) => x.isEnabledFilterDay),
    shareReplay(1)
  );

  readonly isEnabledDayFunction$: Observable<DecisionFunction<DateTimingRelativeIndexFactoryInput>> = this.state$.pipe(
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

  readonly currentTimezone$: Observable<Maybe<TimezoneString>> = this.state$.pipe(
    map((x) => x.timezone),
    distinctUntilChanged(),
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

  readonly currentSelectionValueStart$ = this.currentSelectionValue$.pipe(
    map((x) => x?.dateScheduleRange.start),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly currentSelectionValueDateBlockTimingDateFactory$ = this.currentSelectionValueStart$.pipe(
    map((start) => (start ? dateBlockTimingDateFactory({ start }) : undefined)),
    shareReplay(1)
  );

  readonly currentSelectionValueDateBlockDurationSpan$: Observable<DateBlockDurationSpan<DateBlock>[]> = this.currentSelectionValue$.pipe(
    map((x) => (x ? expandDateScheduleRange(x) : [])),
    shareReplay(1)
  );

  readonly selectionValueSelectedIndexes$: Observable<Set<DateBlockIndex>> = this.currentSelectionValueDateBlockDurationSpan$.pipe(
    map((x) => new Set(x.map((y) => y.i))),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  readonly selectionValueSelectedDates$: Observable<Set<ISO8601DayString>> = this.currentSelectionValueDateBlockTimingDateFactory$.pipe(
    switchMap((dateFactory) => {
      return dateFactory ? this.selectionValueSelectedIndexes$.pipe(map((x) => mapValuesToSet(x, (y) => formatToISO8601DayString(dateFactory(y))))) : of(new Set<ISO8601DayString>());
    }),
    shareReplay(1)
  );

  readonly selectionValue$ = this.currentSelectionValue$.pipe(filterMaybe(), shareReplay(1));

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

  readonly selectionValueWithTimezone$ = this.currentSelectionValueWithTimezone$.pipe(filterMaybe(), shareReplay(1));

  readonly selectionValueWithTimezoneDateBlockDurationSpan$: Observable<DateBlockDurationSpan<DateBlock>[]> = this.selectionValueWithTimezone$.pipe(
    map((x) => expandDateScheduleRange(x)),
    shareReplay(1)
  );

  readonly nextToggleSelection$: Observable<Maybe<AllOrNoneSelection>> = this.hasConfiguredMinMaxRange$.pipe(
    switchMap((hasConfiguredMinMaxRange) => {
      let obs: Observable<Maybe<AllOrNoneSelection>>;

      if (hasConfiguredMinMaxRange) {
        obs = this.currentSelectionValue$.pipe(map((x) => (x ? 'none' : 'all')));
      } else {
        obs = this.currentSelectionValue$.pipe(map((x) => (x ? 'none' : undefined)));
      }

      return obs;
    }),
    shareReplay(1)
  );

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
    map((x) => x.toggledIndexes.size > 0),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isViewReadonly$ = this.state$.pipe(
    map((x) => x.isViewReadonly),
    distinctUntilChanged(),
    shareReplay(1)
  );

  // MARK: State Changes
  readonly setMinMaxDateRange = this.updater(updateStateWithMinMaxDateRange);
  readonly setFilter = this.updater(updateStateWithFilter);
  readonly setExclusions = this.updater(updateStateWithExclusions);
  readonly setComputeSelectionResultRelativeToFilter = this.updater(updateStateWithComputeSelectionResultRelativeToFilter);
  readonly clearFilter = this.updater((state) => updateStateWithFilter(state, undefined));

  readonly setTimezone = this.updater(updateStateWithTimezoneValue);
  readonly setInputRange = this.updater(updateStateWithChangedRange);

  // NOTE: Selected dates are NOT selected indexes. They are the internal selected dates that are excluded from the selection.
  readonly toggleSelectedDates = this.updater((state, toggle: IterableOrValue<DateTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { toggle }));
  readonly addSelectedDates = this.updater((state, add: IterableOrValue<DateTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { add }));
  readonly removeSelectedDates = this.updater((state, remove: IterableOrValue<DateTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { remove }));
  readonly setSelectedDates = this.updater((state, set: IterableOrValue<DateTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { set }));

  // NOTE: Selected indexes are the typical/expected indexes that are selected or not.
  readonly setSelectedIndexes = this.updater((state, set: IterableOrValue<DateTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { set, invertSetBehavior: true }));

  readonly selectAllDates = this.updater((state, selectAll: AllOrNoneSelection = 'all') => updateStateWithChangedDates(state, { selectAll }));
  readonly setInitialSelectionState = this.updater(updateStateWithInitialSelectionState);

  readonly setScheduleDays = this.updater(updateStateWithChangedScheduleDays);
  readonly setAllowAllScheduleDays = this.updater((state) => updateStateWithChangedScheduleDays(state, null));

  readonly setDateScheduleRangeValue = this.updater((state, value: Maybe<DateScheduleRange>) => updateStateWithDateScheduleRangeValue(state, value));
  readonly setCellContentFactory = this.updater((state, cellContentFactory: CalendarScheduleSelectionCellContentFactory) => ({ ...state, cellContentFactory }));

  /**
   * Used by the parent view to propogate a readonly state.
   *
   * Should typically not be used by the user directly with the intention of the parent synchronizing to this state.
   */
  readonly setViewReadonlyState = this.updater((state, isViewReadonly: boolean) => ({ ...state, isViewReadonly }));
}

export function updateStateWithInitialSelectionState(state: CalendarScheduleSelectionState, initialSelectionState: Maybe<AllOrNoneSelection>): CalendarScheduleSelectionState {
  const { toggledIndexes } = state;

  if (toggledIndexes.size === 0 && initialSelectionState === 'all') {
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

  let isEnabledFilterDay: Maybe<DecisionFunction<DateTimingRelativeIndexFactoryInput>> = () => true;
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
      enabledFilter.setStartAsMinDate = filter?.start ? true : false; // If a start date is set, then it becomes the floor.
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

export function updateStateWithTimezoneValue(state: CalendarScheduleSelectionState, timezone: Maybe<TimezoneString>): CalendarScheduleSelectionState {
  const { currentSelectionValue } = state;

  const timezoneNormal = timezone ? dateTimezoneUtcNormal({ timezone }) : undefined;

  if (timezoneNormal && currentSelectionValue) {
    // update the selection value to reflect the timezone changes.

    const { dateScheduleRange: currentDateScheduleRange } = currentSelectionValue;
    const start = timezoneNormal.targetDateToSystemDate(currentDateScheduleRange.start);
    const end = timezoneNormal.targetDateToSystemDate(currentDateScheduleRange.end);

    const newRange: DateScheduleRange = {
      ...currentSelectionValue.dateScheduleRange,
      start,
      end
    };

    return updateStateWithDateScheduleRangeValue({ ...state, timezone, timezoneNormal }, newRange);
  } else {
    return { ...state, timezone, timezoneNormal }; // no change in value
  }
}

export function updateStateWithDateScheduleRangeValue(state: CalendarScheduleSelectionState, change: Maybe<DateScheduleRange>): CalendarScheduleSelectionState {
  const { timezoneNormal, currentSelectionValue } = state;
  const currentDateScheduleRange = currentSelectionValue?.dateScheduleRange; // current range is always in system time

  if (!calendarScheduleStartBeingUsedFromFilter(state) && timezoneNormal) {
    // When using timezones, always return from the start of the day. Inputs are converted to the system time and used as the start of the day.
    // Outputs remain accurate.

    if (change) {
      change = {
        ...change,
        start: startOfDay(timezoneNormal.systemDateToTargetDate(change.start)),
        end: startOfDay(timezoneNormal.systemDateToTargetDate(change.end))
      };
    }
  }

  const isSameValue = isSameDateScheduleRange(currentDateScheduleRange, change);

  if (isSameValue) {
    return state;
  } else {
    if (change != null) {
      const nextState: CalendarScheduleSelectionState = { ...state, inputStart: change.start, inputEnd: change.end, toggledIndexes: new Set(change.ex) };
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
  toggle?: IterableOrValue<DateTimingRelativeIndexFactoryInput>;
  add?: IterableOrValue<DateTimingRelativeIndexFactoryInput>;
  remove?: IterableOrValue<DateTimingRelativeIndexFactoryInput>;
  set?: IterableOrValue<DateTimingRelativeIndexFactoryInput>;
  selectAll?: AllOrNoneSelection;
  /**
   * Inverts the set date changing behavior so that the set input is treated as items that should be retained instead of excluded.
   *
   * Ignored when set is not used. Ignored for selectAll.
   */
  invertSetBehavior?: boolean;
}

export function updateStateWithChangedDates(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionStateDatesChange): CalendarScheduleSelectionState {
  const { indexFactory, allowedDaysOfWeek, indexDayOfWeek, inputStart: currentInputStart, inputEnd: currentInputEnd, minMaxDateRange, filter } = state;
  const { start: minDate, end: maxDate } = calendarScheduleMinAndMaxDateRange(state);
  let inputStart = currentInputStart;
  let inputEnd = currentInputEnd;

  /**
   * This is a set of indexes that are internally "selected" so that they are excluded from the inputStart/inputEnd date range.
   *
   * Do not confuse this with the actual indexes that are selected.
   */
  let toggledIndexes: Set<DateBlockIndex>;

  function asIndexes(indexes: IterableOrValue<DateTimingRelativeIndexFactoryInput>): DateBlockIndex[] {
    return iterableToArray(indexes).map(indexFactory);
  }

  if (change.reset || change.selectAll != null || change.set != null) {
    let set: Maybe<IterableOrValue<DateTimingRelativeIndexFactoryInput>> = change.set ?? [];
    const selectAll: Maybe<AllOrNoneSelection> = change.reset === true ? state.initialSelectionState : change.selectAll;

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

    toggledIndexes = new Set(asIndexes(set));

    if (change.invertSetBehavior && minDate && maxDate && !selectAll) {
      const minIndex = indexFactory(minDate);
      const maxIndex = indexFactory(maxDate);

      inputStart = minDate;
      inputEnd = maxDate;
      toggledIndexes = new Set(range(minIndex, maxIndex + 1).filter((x) => !toggledIndexes.has(x)));
    }
  } else {
    toggledIndexes = new Set(state.toggledIndexes);

    if (change.toggle) {
      const allowedToToggle = asIndexes(change.toggle).filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
      toggleInSet(toggledIndexes, allowedToToggle);
    }

    let addToExclusion: Maybe<IterableOrValue<DateTimingRelativeIndexFactoryInput>>;
    let removeFromExclusion: Maybe<IterableOrValue<DateTimingRelativeIndexFactoryInput>>;

    if (change.add) {
      if (change.invertSetBehavior) {
        addToExclusion = change.add;
      } else {
        removeFromExclusion = change.add;
      }
    }

    if (change.remove) {
      if (change.invertSetBehavior) {
        removeFromExclusion = change.remove;
      } else {
        addToExclusion = change.remove;
      }
    }

    if (addToExclusion) {
      removeFromSet(toggledIndexes, asIndexes(addToExclusion));
    }

    if (removeFromExclusion) {
      addToSet(toggledIndexes, asIndexes(removeFromExclusion));
    }
  }

  const nextState = { ...state, inputStart, inputEnd, toggledIndexes };
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);

  // Recalculate the range and simplified to exclusions
  const rangeAndExclusion = computeScheduleSelectionRangeAndExclusion(nextState);

  if (rangeAndExclusion) {
    return finalizeNewCalendarScheduleSelectionState({ ...nextState, toggledIndexes: new Set(rangeAndExclusion.excluded), inputStart: rangeAndExclusion.start, inputEnd: rangeAndExclusion.end });
  } else {
    // no selected days
    return noSelectionCalendarScheduleSelectionState(nextState);
  }
}

export function noSelectionCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): CalendarScheduleSelectionState {
  return finalizeNewCalendarScheduleSelectionState({ ...state, toggledIndexes: new Set(), inputStart: null, inputEnd: null });
}

export function updateStateWithChangedRange(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionInputDateRange): CalendarScheduleSelectionState {
  const { inputStart: currentInputStart, inputEnd: currentInputEnd, indexFactory, minMaxDateRange } = state;
  const { start: minDate, end: maxDate }: Partial<DateRange> = minMaxDateRange ?? {};

  const inputStart: Date = startOfDay(change.inputStart);
  const inputEnd: Date = endOfDay(change.inputEnd);

  const isValidRange = minDate != null || maxDate != null ? isDateInDateRangeFunction({ start: minDate ?? undefined, end: maxDate ?? undefined }) : () => true;

  if (!isValidRange(inputStart) || !isValidRange(inputEnd) || (isSameDateDay(inputStart, currentInputStart) && isSameDateDay(inputEnd, currentInputEnd))) {
    return state; // if no change, return the current state.
  }

  // retain all indexes that are within the new range
  const minIndex = indexFactory(inputStart);
  const maxIndex = indexFactory(inputEnd) + 1;

  const currentIndexes: DateBlockIndex[] = Array.from(state.toggledIndexes);
  const isInCurrentRange = isIndexNumberInIndexRangeFunction({ minIndex, maxIndex });
  const excludedIndexesInNewRange = currentIndexes.filter(isInCurrentRange);
  const toggledIndexes = new Set(excludedIndexesInNewRange);

  const nextState = { ...state, toggledIndexes, inputStart, inputEnd };
  return finalizeNewCalendarScheduleSelectionState(nextState);
}

export function finalizeNewCalendarScheduleSelectionState(nextState: CalendarScheduleSelectionState): CalendarScheduleSelectionState {
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState);
  nextState.currentSelectionValue = computeScheduleSelectionValue(nextState);
  return nextState;
}

export function isEnabledDayInCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): DecisionFunction<DateTimingRelativeIndexFactoryInput> {
  const { indexFactory, inputStart, inputEnd, indexDayOfWeek, allowedDaysOfWeek } = state;

  let isInStartAndEndRange: IsDateWithinDateBlockRangeFunction;

  if (inputStart && inputEnd) {
    isInStartAndEndRange = isDateWithinDateBlockRangeFunction({ start: state.start, range: { start: inputStart, end: inputEnd } });
  } else {
    isInStartAndEndRange = () => false;
  }

  return (input: DateTimingRelativeIndexFactoryInput) => {
    const index = indexFactory(input);
    const dayOfWeek = indexDayOfWeek(index);

    const isInSelectedRange = isInStartAndEndRange(index);
    const isSelected = state.toggledIndexes.has(index);
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
  const enabledExclusionIndexes = Array.from(state.toggledIndexes).filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
  const minAndMaxSelectedValues = minAndMaxNumber(enabledExclusionIndexes);

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
