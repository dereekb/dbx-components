import { Injectable } from '@angular/core';
import {
  DateCellDayOfWeekFactory,
  dateCellDayOfWeekFactory,
  DateCellIndex,
  DateCellRangeWithRange,
  dateCellTimingDateFactory,
  DateRange,
  dateCellScheduleDateFilter,
  copyDateCellScheduleDateFilterConfig,
  DateCellScheduleDateFilterConfig,
  DateCellScheduleDayCode,
  dateCellScheduleEncodedWeek,
  DateCellScheduleEncodedWeek,
  DateCellTimingRelativeIndexFactory,
  dateCellTimingRelativeIndexFactory,
  expandDateCellScheduleDayCodes,
  expandDateCellScheduleDayCodesToDayOfWeekSet,
  findMaxDate,
  findMinDate,
  isDateInDateRangeFunction,
  IsDateWithinDateCellRangeFunction,
  isDateWithinDateCellRangeFunction,
  isSameDate,
  isSameDateDay,
  isSameDateRange,
  DateOrDateRangeOrDateCellIndexOrDateCellRange,
  dateCellTimingRelativeIndexArrayFactory,
  isInfiniteDateRange,
  copyHoursAndMinutesFromDate,
  dateTimezoneUtcNormal,
  DateTimezoneUtcNormalInstance,
  expandDateCellScheduleRange,
  DateCell,
  DateCellDurationSpan,
  formatToISO8601DayString,
  DateCellTimingRelativeIndexFactoryInput,
  dateCellScheduleDayCodesAreSetsEquivalent,
  simplifyDateCellScheduleDayCodes,
  fullWeekDateCellScheduleDayCodes,
  dateCellTimingStartDateFactory,
  DateCellScheduleDateRange,
  dateCellTimingStartsAtForStartOfDay,
  isSameDateCellScheduleDateRange,
  FullDateCellScheduleRangeInputDateRange,
  fullDateCellScheduleRange,
  dateCellTimingTimezoneNormalInstance,
  changeDateCellScheduleDateRangeToTimezone,
  updateDateCellTimingToSystemTimezone,
  SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE,
  getLeastAndGreatestDateCellIndexInDateCellRanges
} from '@dereekb/date';
import { distinctUntilHasDifferentValues, filterMaybe } from '@dereekb/rxjs';
import { Maybe, TimezoneString, DecisionFunction, IterableOrValue, iterableToArray, addToSet, toggleInSet, isIndexNumberInIndexRangeFunction, MaybeMap, minAndMaxNumber, DayOfWeek, range, AllOrNoneSelection, unique, mergeArrays, ArrayOrValue, ISO8601DayString, mapValuesToSet, isInAllowedDaysOfWeekSet, Building, firstValue, firstValueFromIterable, isIterable, removeFromSet } from '@dereekb/util';
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

/**
 * DbxCalendarScheduleSelectionStore selection mode.
 *
 * When in single mode the toggle function is treated as a set that clears all values and only selects the toggle'd value.
 */
export type DbxCalendarScheduleSelectionStoreSelectionMode = 'multiple' | 'single';

export interface CalendarScheduleSelectionState extends PartialCalendarScheduleSelectionInputDateRange {
  /**
   * Selection mode for this calendar. Defaults to "multiple"
   */
  readonly selectionMode: DbxCalendarScheduleSelectionStoreSelectionMode;
  /**
   * Readonly state of the view.
   *
   * Does not affect state changes directly, but instead acts as a flag for the parent view to set and the consuming views to update on.
   */
  readonly isViewReadonly?: Maybe<boolean>;
  /**
   * Set of the days of week that are allowed by default.
   */
  readonly defaultScheduleDays: Set<DateCellScheduleDayCode>;
  /**
   * Filters the days of the schedule to only allow selecting days in the schedule.
   *
   * The output will be relative to this filter, and in it's timezone unless computeSelectionResultRelativeToFilter is false.
   *
   * This is a copy of any set/configured input filter and will have a start date set from start or startsAt.
   */
  readonly filter?: Maybe<DateCellScheduleDateFilterConfig>;
  /**
   * Additional exclusions that may not be defined within the filter.
   */
  readonly inputExclusions?: Maybe<ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>>;
  /**
   * The computed exclusions given the input exclusions.
   */
  readonly computedExclusions?: Maybe<DateCellIndex[]>;
  /**
   * The min/max date range. Used for restricting the min/max value. Works with the filter. The greater/lesser of the start/end dates are used if both are provided.
   */
  readonly minMaxDateRange?: Maybe<Partial<DateRange>>;
  /**
   * Start date. Is updated as the inputStart is modified or filter is provided that provides the start date.
   *
   * Defaults to today and the current timezone.
   */
  readonly start: DateCellScheduleDateRange['start'];
  /**
   * System Timezone. Does not change.
   */
  readonly systemTimezone: TimezoneString;
  /**
   * Timezone to use when outputting the value. Only influences the output start date.
   */
  readonly outputTimezone?: Maybe<TimezoneString>;
  /**
   * Current timezone normal with the current timezone.
   */
  readonly outputTimezoneNormal?: Maybe<DateTimezoneUtcNormalInstance>;
  /**
   * DateCellTimingRelativeIndexFactory
   */
  readonly indexFactory: DateCellTimingRelativeIndexFactory;
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
  readonly toggledIndexes: Set<DateCellIndex>;
  /**
   * Days of the schedule that are allowed to be picked. If not defined, defaults to defaultScheduleDays.
   */
  readonly scheduleDays?: Maybe<Set<DateCellScheduleDayCode>>;
  /**
   * The current DateCellScheduleDayCode value.
   */
  readonly effectiveScheduleDays: Set<DateCellScheduleDayCode>;
  /**
   * Set of the days of week that are allowed. Derived from the current schedule days value.
   */
  readonly allowedDaysOfWeek: Set<DayOfWeek>;
  /**
   *
   */
  readonly indexDayOfWeek: DateCellDayOfWeekFactory;
  /**
   * Decision function that returns true if a value is enabled given the current filter.
   */
  readonly isEnabledFilterDay: DecisionFunction<DateCellTimingRelativeIndexFactoryInput>;
  /**
   * Decision function that returns true if a value is enabled.
   *
   * This function does not take the current filter into account.
   */
  readonly isEnabledDay: DecisionFunction<DateCellTimingRelativeIndexFactoryInput>;
  /**
   * CalendarScheduleSelectionCellContentFactory for the view.
   */
  readonly cellContentFactory: CalendarScheduleSelectionCellContentFactory;
  /**
   * Current selection value.
   */
  readonly currentSelectionValue?: Maybe<CalendarScheduleSelectionValue>;
  /**
   * Whether or not to use the filter as the start and end range instead of optimizing for the current index.
   *
   * Defaults to true.
   */
  readonly computeSelectionResultRelativeToFilter?: Maybe<boolean>;
  /**
   * The initial selection state when the calendar is reset.
   */
  readonly initialSelectionState?: Maybe<AllOrNoneSelection>;
}

export function initialCalendarScheduleSelectionState(): CalendarScheduleSelectionState {
  const defaultScheduleDays = new Set([DateCellScheduleDayCode.WEEKDAY, DateCellScheduleDayCode.WEEKEND]);
  const allowedDaysOfWeek = expandDateCellScheduleDayCodesToDayOfWeekSet(defaultScheduleDays);
  const defaultStartsAt = dateCellTimingStartsAtForStartOfDay(); // get midnight of the current timezone
  const { startsAt, timezone: systemTimezone } = defaultStartsAt;
  const indexFactory = dateCellTimingRelativeIndexFactory(defaultStartsAt);
  const indexDayOfWeek = dateCellDayOfWeekFactory(startsAt);

  return {
    selectionMode: 'multiple',
    start: startsAt,
    systemTimezone,
    indexFactory,
    toggledIndexes: new Set(),
    defaultScheduleDays,
    effectiveScheduleDays: defaultScheduleDays,
    allowedDaysOfWeek,
    indexDayOfWeek,
    isEnabledFilterDay: () => true,
    isEnabledDay: () => false,
    computeSelectionResultRelativeToFilter: true,
    cellContentFactory: defaultCalendarScheduleSelectionCellContentFactory
  };
}

/**
 * This is used in cases where the dates in the min/max date range need to be shifted to the filter's timezone.
 *
 * This is because the index factory is always in system timezone, but when selecting all/none with a filter we need to use the filter's timezone.
 *
 * @param x
 * @returns
 */
function calendarScheduleMinAndMaxDateRangeRelativeToFilter(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Partial<DateRange> {
  let input: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'> = x;

  if (x.filter?.timezone && x.minMaxDateRange != null) {
    const filterNormal = dateTimezoneUtcNormal(x.filter.timezone);
    const transformFn = filterNormal.transformFunction('systemDateToTargetDate');

    input = {
      filter: x.filter,
      minMaxDateRange: {
        start: x.minMaxDateRange.start ? transformFn(x.minMaxDateRange.start) : undefined,
        end: x.minMaxDateRange.end ? transformFn(x.minMaxDateRange.end) : undefined
      }
    };
  }

  return calendarScheduleMinAndMaxDateRange(input);
}

export function calendarScheduleMinAndMaxDateRange(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Partial<DateRange> {
  return {
    start: calendarScheduleMinDate(x) || undefined,
    end: calendarScheduleMaxDate(x) || undefined
  };
}

export function calendarScheduleMinDate(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Maybe<Date> {
  return findMaxDate([x.filter?.start, x.minMaxDateRange?.start]);
}

export function calendarScheduleMaxDate(x: Pick<CalendarScheduleSelectionState, 'filter' | 'minMaxDateRange'>): Maybe<Date> {
  return findMinDate([x.filter?.end, x.minMaxDateRange?.end]);
}

export function calendarScheduleStartBeingUsedFromFilter(x: Pick<CalendarScheduleSelectionState, 'filter' | 'computeSelectionResultRelativeToFilter'>) {
  return x.computeSelectionResultRelativeToFilter && x.filter?.start != null; // may be using either
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
  readonly selectionMode$ = this.state$.pipe(
    map((x) => x.selectionMode),
    distinctUntilChanged(),
    shareReplay(1)
  );

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
    map(({ inputStart, inputEnd }) => ({ start: inputStart, end: inputEnd })),
    distinctUntilChanged((a, b) => isSameDateRange(a as DateRange, b as DateRange)),
    map((x) => ({ inputStart: x.start, inputEnd: x.end })),
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
  readonly selectedDates$: Observable<Set<DateCellIndex>> = this.state$.pipe(
    map((x) => x.toggledIndexes),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isEnabledFilterDayFunction$: Observable<DecisionFunction<DateCellTimingRelativeIndexFactoryInput>> = this.state$.pipe(
    map((x) => x.isEnabledFilterDay),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly isEnabledDayFunction$: Observable<DecisionFunction<DateCellTimingRelativeIndexFactoryInput>> = this.state$.pipe(
    map((x) => x.isEnabledDay),
    distinctUntilChanged(),
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

  readonly allowedDaysOfWeek$: Observable<Set<DayOfWeek>> = this.state$.pipe(
    map((x) => x.allowedDaysOfWeek),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  readonly isInAllowedDaysOfWeekFunction$ = this.allowedDaysOfWeek$.pipe(
    map((x) => isInAllowedDaysOfWeekSet(x)),
    shareReplay(1)
  );

  readonly scheduleDays$: Observable<Set<DateCellScheduleDayCode>> = this.state$.pipe(
    map((x) => x.effectiveScheduleDays),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  readonly outputTimezone$: Observable<Maybe<TimezoneString>> = this.state$.pipe(
    map((x) => x.outputTimezone),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * The timezone of the output values.
   *
   * If an outputTimezone is not specified, this defaults to the system timezone.
   */
  readonly effectiveOutputTimezone$: Observable<TimezoneString> = this.state$.pipe(
    map((x) => x.outputTimezone || x.systemTimezone),
    distinctUntilChanged(),
    shareReplay(1)
  );

  /**
   * An outputTimezoneNormal to use.
   *
   * If an outputTimezone is not specified, this is undefined.
   */
  readonly effectiveOutputTimezoneNormal$: Observable<Maybe<DateTimezoneUtcNormalInstance>> = this.state$.pipe(
    map((x) => (x.outputTimezoneNormal ? x.outputTimezoneNormal : undefined)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentSelectionValue$ = this.state$.pipe(
    map((x) => x.currentSelectionValue),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly currentSelectionValueStart$ = this.currentSelectionValue$.pipe(
    map((x) => x?.dateScheduleRange.start),
    distinctUntilChanged(isSameDate),
    shareReplay(1)
  );

  readonly currentSelectionValueDateCellTimingDateFactory$ = this.currentSelectionValue$.pipe(
    map((x) => (x ? dateCellTimingDateFactory({ startsAt: x.dateScheduleRange.start, timezone: x.dateScheduleRange.timezone }) : undefined)),
    shareReplay(1)
  );

  readonly currentSelectionValueDateCellDurationSpanExpansion$: Observable<DateCellDurationSpan<DateCell>[]> = this.currentSelectionValue$.pipe(
    map((x) => (x ? expandDateCellScheduleRange({ dateCellScheduleRange: x.dateScheduleRange }) : [])),
    shareReplay(1)
  );

  readonly selectionValueSelectedIndexes$: Observable<Set<DateCellIndex>> = this.currentSelectionValueDateCellDurationSpanExpansion$.pipe(
    map((x) => new Set(x.map((y) => y.i))),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  readonly selectionValueSelectedDates$: Observable<Set<ISO8601DayString>> = this.currentSelectionValueDateCellTimingDateFactory$.pipe(
    switchMap((dateFactory) => {
      return dateFactory ? this.selectionValueSelectedIndexes$.pipe(map((x) => mapValuesToSet(x, (y) => formatToISO8601DayString(dateFactory(y))))) : of(new Set<ISO8601DayString>());
    }),
    shareReplay(1)
  );

  readonly selectionValue$ = this.currentSelectionValue$.pipe(filterMaybe(), shareReplay(1));

  readonly currentSelectionValueWithTimezone$ = this.currentSelectionValue$.pipe(
    combineLatestWith(this.effectiveOutputTimezoneNormal$),
    map(([x, timezoneNormal]) => {
      let currentValueWithTimezone = x;

      if (x && timezoneNormal) {
        currentValueWithTimezone = {
          dateScheduleRange: changeDateCellScheduleDateRangeToTimezone(x.dateScheduleRange, timezoneNormal),
          minMaxRange: x.minMaxRange
        } as CalendarScheduleSelectionValue;
      }

      return currentValueWithTimezone;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly selectionValueWithTimezone$ = this.currentSelectionValueWithTimezone$.pipe(filterMaybe(), shareReplay(1));

  readonly selectionValueWithTimezoneDateCellDurationSpanExpansion$: Observable<DateCellDurationSpan<DateCell>[]> = this.selectionValueWithTimezone$.pipe(
    map((x) => expandDateCellScheduleRange({ dateCellScheduleRange: x.dateScheduleRange })),
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

  readonly currentDateCellScheduleRangeValue$ = this.currentSelectionValueWithTimezone$.pipe(
    map((x) => x?.dateScheduleRange),
    distinctUntilChanged(isSameDateCellScheduleDateRange),
    shareReplay(1)
  );

  readonly dateCellScheduleRangeValue$ = this.currentDateCellScheduleRangeValue$.pipe(filterMaybe(), shareReplay(1));

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
  readonly setDefaultWeek = this.updater(updateStateWithMinMaxDateRange);
  readonly setFilter = this.updater(updateStateWithFilter);
  readonly setExclusions = this.updater(updateStateWithExclusions);
  readonly setComputeSelectionResultRelativeToFilter = this.updater(updateStateWithComputeSelectionResultRelativeToFilter);
  readonly clearFilter = this.updater((state) => updateStateWithFilter(state, undefined));

  readonly setOutputTimezone = this.updater(updateStateWithTimezoneValue);
  /**
   * Sets the "input" date range. This is the range that gets displayed on the date range picker.
   */
  readonly setInputRange = this.updater(updateStateWithChangedRange);

  // NOTE: Selected dates are NOT selected indexes. They are the internal selected dates that are excluded from the selection.
  readonly toggleSelectedDates = this.updater((state, toggle: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { toggle }));
  readonly addSelectedDates = this.updater((state, add: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { add }));
  readonly removeSelectedDates = this.updater((state, remove: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { remove }));
  readonly setSelectedDates = this.updater((state, set: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { set }));
  readonly selectAllDates = this.updater((state, selectAll: AllOrNoneSelection = 'all') => updateStateWithChangedDates(state, { selectAll }));

  // NOTE: Selected indexes are the typical/expected indexes that are selected or not.
  readonly setSelectedIndexes = this.updater((state, set: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>) => updateStateWithChangedDates(state, { set, invertSetBehavior: true }));
  readonly setInitialSelectionState = this.updater(updateStateWithInitialSelectionState);

  readonly setDefaultScheduleDays = this.updater(updateStateWithChangedDefaultScheduleDays);
  readonly setScheduleDays = this.updater(updateStateWithChangedScheduleDays);
  readonly setAllowAllScheduleDays = this.updater((state) => updateStateWithChangedScheduleDays(state, [DateCellScheduleDayCode.WEEKDAY, DateCellScheduleDayCode.WEEKEND]));

  readonly setDateScheduleRangeValue = this.updater((state, value: Maybe<FullDateCellScheduleRangeInputDateRange>) => updateStateWithDateCellScheduleRangeValue(state, value));
  readonly setCellContentFactory = this.updater((state, cellContentFactory: CalendarScheduleSelectionCellContentFactory) => ({ ...state, cellContentFactory }));

  /**
   * Sets the selection mode.
   */
  readonly setSelectionMode = this.updater(updateStateWithSelectionMode);

  /**
   * Used by the parent view to propogate a readonly state.
   *
   * Should typically not be used by the user directly with the intention of the parent synchronizing to this state.
   */
  readonly setViewReadonlyState = this.updater((state, isViewReadonly: boolean) => ({ ...state, isViewReadonly }));

  // MARK: Compat
  /**
   * @deprecated use setOutputTimezone instead.
   */
  readonly setTimezone = this.setOutputTimezone;

  /**
   * @deprecated use ouputTimezone$
   */
  readonly currentTimezone$: Observable<Maybe<TimezoneString>> = this.outputTimezone$;

  /**
   * @deprecated use effectiveOuputTimezone$
   */
  readonly effectiveTimezone$: Observable<Maybe<TimezoneString>> = this.effectiveOutputTimezone$;

  /**
   * @deprecated use effectiveOuputTimezoneNormal$
   */
  readonly effectiveTimezoneNormal$ = this.effectiveOutputTimezoneNormal$;

  /**
   * @deprecated use currentSelectionValueDateCellDurationSpanExpansion$
   */
  readonly currentSelectionValueDateBlockDurationSpan$ = this.currentSelectionValueDateCellDurationSpanExpansion$;

  /**
   * @deprecated use selectionValueWithTimezoneDateCellDurationSpanExpansion$
   */
  readonly selectionValueWithTimezoneDateBlockDurationSpan$ = this.selectionValueWithTimezoneDateCellDurationSpanExpansion$;
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

export function updateStateWithExclusions(state: CalendarScheduleSelectionState, inputExclusions: Maybe<ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>>): CalendarScheduleSelectionState {
  let computedExclusions: Maybe<DateCellIndex[]>;

  if (inputExclusions) {
    const { indexFactory } = state;
    const indexArrayFactory = dateCellTimingRelativeIndexArrayFactory(indexFactory);
    computedExclusions = indexArrayFactory(inputExclusions);
  }

  state = { ...state, inputExclusions, computedExclusions };
  return updateStateWithFilter(state, state.filter);
}

export function updateStateWithMinMaxDateRange(state: CalendarScheduleSelectionState, minMaxDateRange: Maybe<Partial<DateRange>>): CalendarScheduleSelectionState {
  if (minMaxDateRange != null && !isInfiniteDateRange(minMaxDateRange)) {
    state = {
      ...state,
      minMaxDateRange: {
        start: minMaxDateRange.start != null ? startOfDay(minMaxDateRange.start) : undefined,
        end: minMaxDateRange.end != null ? endOfDay(minMaxDateRange.end) : undefined
      }
    };
  } else {
    state = { ...state, minMaxDateRange: undefined };
  }

  return updateStateWithFilter(state, state.filter);
}

export function updateStateWithFilter(currentState: CalendarScheduleSelectionState, inputFilter: Maybe<DateCellScheduleDateFilterConfig>): CalendarScheduleSelectionState {
  const { computedExclusions: exclusions, minMaxDateRange, systemTimezone } = currentState;

  let isEnabledFilterDay: Maybe<DecisionFunction<DateCellTimingRelativeIndexFactoryInput>> = () => true;
  let filter: Maybe<DateCellScheduleDateFilterConfig> = null;

  // create the filter using inputFilter, exclusions, and minMaxDateRange
  if (inputFilter || exclusions?.length || minMaxDateRange) {
    let enabledFilter: DateCellScheduleDateFilterConfig;
    let filterStart: Maybe<Date> = null; // the start date that will be used/set on the filter.

    if (inputFilter) {
      filter = copyDateCellScheduleDateFilterConfig(inputFilter); // copy filter

      let nextFilterTimezone: TimezoneString | undefined; // only set if inputFilter.start or inputFilter.startsAt

      // configure filter start
      if (inputFilter.start) {
        filterStart = inputFilter.start;

        // if no timezone is specified, then use the system timezone and align filterStart to the start of the day.
        if (!inputFilter.timezone) {
          filterStart = SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(inputFilter.startsAt);
          nextFilterTimezone = systemTimezone;
        } else {
          nextFilterTimezone = inputFilter.timezone;
        }
      } else if (inputFilter.startsAt) {
        if (inputFilter.timezone) {
          // if no timezone is provided, use startsAt as-is
          const timezoneNormal = dateTimezoneUtcNormal(inputFilter.timezone);
          filterStart = timezoneNormal.startOfDayInTargetTimezone(inputFilter.startsAt);
          nextFilterTimezone = inputFilter.timezone;
        } else {
          // set to the start of today in the system timezone.
          filterStart = SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.startOfDayInTargetTimezone(inputFilter.startsAt);
          nextFilterTimezone = systemTimezone;
        }
      }

      filter.start = filterStart ?? undefined;
      filter.timezone = nextFilterTimezone;

      // configure exclusions
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
      enabledFilter.setStartAsMinDate = filterStart ? true : false; // If a start date is set, then it becomes the floor.
    }

    /**
     * If the input filter has a start date, use that as the relative start to ensure indexes are compared the same,
     * otherwise use the state's start. This is important for the index calculations.
     */
    let finalEnabledStart: Date;
    let finalEnabledTimezone: TimezoneString;
    //  filter?.start ?? state.start;

    if (!enabledFilter.start) {
      // use the current state's start, but make sure it is in the proper timezone.
      if (enabledFilter.timezone) {
        const timezoneNormal = dateTimezoneUtcNormal(enabledFilter.timezone);
        finalEnabledStart = timezoneNormal.startOfDayInTargetTimezone(currentState.start); // get the start of the day for the current start
        finalEnabledTimezone = enabledFilter.timezone;
      } else {
        finalEnabledStart = currentState.start;
        finalEnabledTimezone = systemTimezone;
      }
    } else if (!enabledFilter.timezone) {
      finalEnabledTimezone = systemTimezone;

      const timezoneNormal = dateTimezoneUtcNormal(finalEnabledTimezone);
      finalEnabledStart = timezoneNormal.startOfDayInTargetTimezone(enabledFilter.start); // get the start of the day for the target timezone
    } else {
      finalEnabledStart = enabledFilter.start;
      finalEnabledTimezone = enabledFilter.timezone;
    }

    enabledFilter.start = finalEnabledStart;
    enabledFilter.timezone = finalEnabledTimezone;

    // create the filter
    isEnabledFilterDay = dateCellScheduleDateFilter(enabledFilter);
  }

  let nextState: Building<CalendarScheduleSelectionState> = { ...currentState, filter, isEnabledFilterDay };

  // For the same reason as above, use the filter's start date as the relative start if applicable.
  if (filter && filter.start) {
    let startForSystemTimezone: Date = filter.start;

    if (filter.timezone) {
      const timezoneNormal = dateTimezoneUtcNormal(filter.timezone);
      startForSystemTimezone = timezoneNormal.systemDateToTargetDate(filter.start); // get the start of the day for the system timezone
    }

    nextState.start = startForSystemTimezone;
    nextState.indexFactory = dateCellTimingRelativeIndexFactory({ startsAt: startForSystemTimezone, timezone: systemTimezone });
    nextState.indexDayOfWeek = dateCellDayOfWeekFactory(startForSystemTimezone);
  }

  // attempt to re-apply the initial selection state once filter is applied
  if (nextState.initialSelectionState) {
    nextState = updateStateWithInitialSelectionState(nextState as CalendarScheduleSelectionState, nextState.initialSelectionState);
  }

  // re-calculate the selection given the filter
  const { inputStart, inputEnd } = nextState;

  if (inputStart && inputEnd) {
    nextState = updateStateWithChangedRange(nextState as CalendarScheduleSelectionState, { inputStart, inputEnd });
  }

  return nextState as CalendarScheduleSelectionState;
}

export function updateStateWithTimezoneValue(state: CalendarScheduleSelectionState, timezone: Maybe<TimezoneString>): CalendarScheduleSelectionState {
  const { currentSelectionValue } = state;
  const timezoneNormal = timezone ? dateTimezoneUtcNormal({ timezone }) : undefined;

  if (timezoneNormal && currentSelectionValue) {
    // update the selection value to reflect the timezone changes.
    const { dateScheduleRange: currentDateCellScheduleRange } = currentSelectionValue;
    const start = timezoneNormal.targetDateToSystemDate(currentDateCellScheduleRange.start);
    const end = timezoneNormal.targetDateToSystemDate(currentDateCellScheduleRange.end);

    const newRange: DateCellScheduleDateRange = {
      ...currentSelectionValue.dateScheduleRange,
      start,
      end
    };

    return updateStateWithDateCellScheduleRangeValue({ ...state, outputTimezone: timezone, outputTimezoneNormal: timezoneNormal }, newRange);
  } else {
    return { ...state, outputTimezone: timezone, outputTimezoneNormal: timezoneNormal }; // no change in value
  }
}

export function updateStateWithDateCellScheduleRangeValue(state: CalendarScheduleSelectionState, inputChange: Maybe<FullDateCellScheduleRangeInputDateRange>): CalendarScheduleSelectionState {
  const { currentSelectionValue, systemTimezone } = state;
  const currentDateCellScheduleRange = currentSelectionValue?.dateScheduleRange; // current range is always in system time
  let change: Maybe<Pick<DateCellScheduleDateRange, 'start' | 'end' | 'ex' | 'w' | 'timezone'>>;

  // When using timezones, always return from the start of the day. Inputs are converted to the system time and used as the start of the day.
  // Outputs remain accurate.

  if (inputChange) {
    // make sure a timezone is set. Input may not have a timezone attached. Default to system time.
    const inputChangeWithTimezoneSet = {
      ...inputChange,
      timezone: inputChange.timezone ?? systemTimezone
    };

    // calculate the schedule range
    const fullChange = fullDateCellScheduleRange({ dateCellScheduleRange: inputChangeWithTimezoneSet });
    const inputNormal = dateCellTimingTimezoneNormalInstance(fullChange);

    const startInSystemTz = inputNormal.systemDateToTargetDate(fullChange.start);
    const endInSystemTz = startOfDay(inputNormal.systemDateToTargetDate(fullChange.end));

    // convert the start/end to system time
    change = {
      start: startInSystemTz,
      end: endInSystemTz,
      w: fullChange.w,
      ex: fullChange.ex,
      timezone: fullChange.timezone
    };
  }

  const isSameValue = isSameDateCellScheduleDateRange(currentDateCellScheduleRange, change);

  if (isSameValue) {
    return state;
  } else {
    if (change != null) {
      const nextState: CalendarScheduleSelectionState = { ...state, inputStart: change.start, inputEnd: change.end, toggledIndexes: new Set(change.ex) };
      return updateStateWithChangedScheduleDays(finalizeNewCalendarScheduleSelectionState(nextState), expandDateCellScheduleDayCodes(change.w || '89'));
    } else {
      return noSelectionCalendarScheduleSelectionState(state); // clear selection, retain disabled days
    }
  }
}

export function updateStateWithChangedDefaultScheduleDays(state: CalendarScheduleSelectionState, change: Maybe<Iterable<DateCellScheduleDayCode>>): CalendarScheduleSelectionState {
  const { defaultScheduleDays: currentDefaultScheduleDays } = state;
  const defaultScheduleDays = new Set(change ?? fullWeekDateCellScheduleDayCodes());

  if (dateCellScheduleDayCodesAreSetsEquivalent(defaultScheduleDays, currentDefaultScheduleDays)) {
    return state; // no change
  } else {
    return finalizeUpdateStateWithChangedScheduleDays(state, { ...state, defaultScheduleDays });
  }
}

export function updateStateWithChangedScheduleDays(state: CalendarScheduleSelectionState, change: Maybe<Iterable<DateCellScheduleDayCode>>): CalendarScheduleSelectionState {
  const { scheduleDays: currentScheduleDays } = state;
  const scheduleDays = new Set(change ?? []);

  let newScheduleDays: Set<DateCellScheduleDayCode> | null | undefined;

  if (currentScheduleDays != null && change != null) {
    if (dateCellScheduleDayCodesAreSetsEquivalent(scheduleDays, currentScheduleDays)) {
      newScheduleDays = undefined; //no change
    } else {
      newScheduleDays = scheduleDays;
    }
  } else if (currentScheduleDays !== change) {
    newScheduleDays = change ? scheduleDays : null; // set the new one, or clear it
  }

  if (newScheduleDays === undefined) {
    return state;
  } else {
    return finalizeUpdateStateWithChangedScheduleDays(state, { ...state, scheduleDays: newScheduleDays ?? undefined });
  }
}

export function updateStateWithSelectionMode(state: CalendarScheduleSelectionState, selectionMode: DbxCalendarScheduleSelectionStoreSelectionMode): CalendarScheduleSelectionState {
  const { selectionMode: currentSelectionMode } = state;

  if (currentSelectionMode !== selectionMode) {
    const nextState = { ...state, selectionMode };

    if (selectionMode === 'multiple') {
      return nextState;
    } else {
      const currentSelectionRange = computeCalendarScheduleSelectionDateCellRange(nextState);
      return currentSelectionRange ? updateStateWithChangedDates(nextState, { set: [currentSelectionRange.i], invertSetBehavior: true }) : nextState;
    }
  } else {
    return state;
  }
}

export function finalizeUpdateStateWithChangedScheduleDays(previousState: CalendarScheduleSelectionState, nextState: CalendarScheduleSelectionState): CalendarScheduleSelectionState {
  const previousScheduleDays = previousState.effectiveScheduleDays;
  const nextScheduleDays = nextState.scheduleDays ?? nextState.defaultScheduleDays;

  if (dateCellScheduleDayCodesAreSetsEquivalent(nextScheduleDays, previousScheduleDays)) {
    return nextState; // the default or input schedule changed but the schedule is still the same, so no need for an update.
  } else {
    const effectiveScheduleDays = new Set(simplifyDateCellScheduleDayCodes(nextScheduleDays));
    const allowedDaysOfWeek = expandDateCellScheduleDayCodesToDayOfWeekSet(nextScheduleDays);

    return finalizeNewCalendarScheduleSelectionState({
      ...nextState,
      // update the effective schedule days and allowed days of week
      effectiveScheduleDays,
      allowedDaysOfWeek
    });
  }
}

export interface CalendarScheduleSelectionStateDatesChange {
  reset?: true;
  toggle?: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>;
  add?: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>;
  remove?: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>;
  set?: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>;
  selectAll?: AllOrNoneSelection;
  /**
   * Inverts the set date changing behavior so that the set input is treated as items that should be retained instead of excluded.
   *
   * Ignored when set is not used. Ignored for selectAll.
   */
  invertSetBehavior?: boolean;
}

export function updateStateWithChangedDates(state: CalendarScheduleSelectionState, change: CalendarScheduleSelectionStateDatesChange): CalendarScheduleSelectionState {
  const { selectionMode, allowedDaysOfWeek, indexFactory, indexDayOfWeek, inputStart: currentInputStart, inputEnd: currentInputEnd, minMaxDateRange, filter } = state;
  const { start: minDateFromFilter, end: maxDateFromFilter } = calendarScheduleMinAndMaxDateRangeRelativeToFilter(state);
  let inputStart = currentInputStart;
  let inputEnd = currentInputEnd;

  /**
   * This is a set of indexes that are internally "selected" so that they are excluded from the inputStart/inputEnd date range.
   *
   * Do not confuse this with the actual indexes that are selected.
   */
  let toggledIndexes: Set<DateCellIndex>;

  function asIndexes(indexes: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>): DateCellIndex[] {
    return iterableToArray(indexes).map(indexFactory);
  }

  // When using selection mode "single" we update the change to reflect the single selection.
  if (selectionMode === 'single') {
    function setFromFirstValue(input: IterableOrValue<DateCellTimingRelativeIndexFactoryInput>): Set<DateCellTimingRelativeIndexFactoryInput> {
      const firstValue = isIterable(input) ? firstValueFromIterable(input) : input;
      const set = new Set<DateCellTimingRelativeIndexFactoryInput>();

      if (firstValue != null) {
        set.add(firstValue);
      }

      return set;
    }

    if (change.set) {
      change = { set: setFromFirstValue(change.set), invertSetBehavior: true };
    } else if (change.toggle) {
      const nextSet = setFromFirstValue(change.toggle);

      if (nextSet.size) {
        const firstSetValueIndex = indexFactory(firstValueFromIterable(nextSet) as DateCellTimingRelativeIndexFactoryInput);

        if (state.toggledIndexes.has(firstSetValueIndex) || (inputStart && indexFactory(inputStart) === firstSetValueIndex)) {
          nextSet.clear(); // clear with the next set
        }

        change = { set: nextSet, invertSetBehavior: true };
      }
    }

    // set, selectAll, add, and remove are treated as they normally are.
  }

  if (change.reset || change.selectAll != null || change.set != null) {
    let set: Maybe<IterableOrValue<DateCellTimingRelativeIndexFactoryInput>> = change.set ?? [];
    const selectAll: Maybe<AllOrNoneSelection> = change.reset === true ? state.initialSelectionState : change.selectAll;

    switch (selectAll) {
      case 'all':
        if (minDateFromFilter != null && maxDateFromFilter != null) {
          inputStart = minDateFromFilter;
          inputEnd = maxDateFromFilter;
          set = [];
        }
        break;
      case 'none':
        inputStart = null;
        inputEnd = null;
        set = [];
        break;
    }

    const inputSetIndexes = asIndexes(set);
    toggledIndexes = new Set(inputSetIndexes);

    if (change.invertSetBehavior && !selectAll) {
      let minIndex: Maybe<number>;
      let maxIndex: Maybe<number>;

      if (minDateFromFilter != null && maxDateFromFilter != null) {
        // only applicable when the filter is set.
        minIndex = indexFactory(minDateFromFilter);
        maxIndex = indexFactory(maxDateFromFilter);

        inputStart = minDateFromFilter;
        inputEnd = maxDateFromFilter;
      } else {
        // when the filter is not set, use the least and greatest indexes from the input set.
        const minAndMax = minAndMaxNumber(inputSetIndexes);

        if (minAndMax != null) {
          minIndex = minAndMax.min;
          maxIndex = minAndMax.max;
          const dateFactory = dateCellTimingStartDateFactory(indexFactory._timing);

          inputStart = dateFactory(minAndMax.min);
          inputEnd = minAndMax.min === minAndMax.max ? inputStart : dateFactory(minAndMax.max);
        } else {
          // equivalent to an empty set / using "none" with selectAll.
          inputStart = null;
          inputEnd = null;
          toggledIndexes = new Set();
        }
      }

      // toggledIndexes should not include any indexes we want to include
      if (minIndex != null && maxIndex != null) {
        toggledIndexes = new Set(range(minIndex, maxIndex + 1).filter((x) => !toggledIndexes.has(x)));
      }
    }
  } else {
    toggledIndexes = new Set(state.toggledIndexes); // copy the set

    if (change.toggle) {
      const allowedToToggle = asIndexes(change.toggle).filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
      toggleInSet(toggledIndexes, allowedToToggle);
    }

    let addToExclusion: Maybe<IterableOrValue<DateCellTimingRelativeIndexFactoryInput>>;
    let removeFromExclusion: Maybe<IterableOrValue<DateCellTimingRelativeIndexFactoryInput>>;

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
  const { inputStart: currentInputStart, inputEnd: currentInputEnd, indexFactory } = state;
  const { start: minDate, end: maxDate } = calendarScheduleMinAndMaxDateRange(state);

  const inputStart: Date = startOfDay(change.inputStart);
  const inputEnd: Date = startOfDay(change.inputEnd); // midnight of the last day

  const isValidRange = minDate != null || maxDate != null ? isDateInDateRangeFunction({ start: minDate ?? undefined, end: maxDate ?? undefined }) : () => true;

  if (!isValidRange(inputStart) || !isValidRange(inputEnd) || (isSameDateDay(inputStart, currentInputStart) && isSameDateDay(inputEnd, currentInputEnd))) {
    return state; // if no change, return the current state.
  }

  // retain all indexes that are within the new range
  const minIndex = indexFactory(inputStart);
  const maxIndex = indexFactory(inputEnd) + 1;

  const currentIndexes: DateCellIndex[] = Array.from(state.toggledIndexes);
  const isInCurrentRange = isIndexNumberInIndexRangeFunction({ minIndex, maxIndex });
  const excludedIndexesInNewRange = currentIndexes.filter(isInCurrentRange);
  const toggledIndexes = new Set(excludedIndexesInNewRange);

  const nextState = { ...state, toggledIndexes, inputStart, inputEnd };
  return finalizeNewCalendarScheduleSelectionState(nextState);
}

export function finalizeNewCalendarScheduleSelectionState(nextState: Building<CalendarScheduleSelectionState>): CalendarScheduleSelectionState {
  nextState.isEnabledDay = isEnabledDayInCalendarScheduleSelectionState(nextState as CalendarScheduleSelectionState);
  nextState.currentSelectionValue = computeScheduleSelectionValue(nextState as CalendarScheduleSelectionState);
  return nextState as CalendarScheduleSelectionState;
}

export function isEnabledDayInCalendarScheduleSelectionState(state: CalendarScheduleSelectionState): DecisionFunction<DateCellTimingRelativeIndexFactoryInput> {
  const { allowedDaysOfWeek, indexFactory, inputStart, inputEnd, indexDayOfWeek, systemTimezone } = state;
  let isInStartAndEndRange: IsDateWithinDateCellRangeFunction;

  if (inputStart && inputEnd) {
    isInStartAndEndRange = isDateWithinDateCellRangeFunction({ startsAt: { startsAt: state.start, timezone: systemTimezone }, range: { start: inputStart, end: inputEnd } });
  } else {
    isInStartAndEndRange = () => false;
  }

  return (input: DateCellTimingRelativeIndexFactoryInput) => {
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
  const { indexFactory: systemIndexFactory, allowedDaysOfWeek, effectiveScheduleDays, indexDayOfWeek, computeSelectionResultRelativeToFilter, filter, systemTimezone } = state;
  let timezone = systemTimezone;
  const rangeAndExclusion = computeScheduleSelectionRangeAndExclusion(state);

  if (rangeAndExclusion == null) {
    return null;
  }

  const { start: rangeStart, end: rangeEnd, excluded: allExcluded, dateCellRange } = rangeAndExclusion;
  let filterOffsetExcludedRange: DateCellIndex[] = [];
  let indexOffset = dateCellRange.i;

  let start = rangeStart;
  let end = rangeEnd;

  // If computeSelectionResultRelativeToFilter is true, then we need to offset the values to be relative to that start.
  if (computeSelectionResultRelativeToFilter && filter?.start) {
    start = filter.start; // always start at the filter's start date
    let startInSystemTimezone = start;

    if (filter.timezone) {
      timezone = filter.timezone;
      const filterNormal = dateTimezoneUtcNormal(timezone);
      end = filterNormal.startOfDayInTargetTimezone(end);
      startInSystemTimezone = filterNormal.systemDateToTargetDate(start); // convert the start to the system timezone normal for deriving the index
    }

    const rangeStartIndex = systemIndexFactory(rangeStart);
    const startIndex = systemIndexFactory(startInSystemTimezone);
    const filterStartIndexOffset = rangeStartIndex - startIndex;
    filterOffsetExcludedRange = range(0, filterStartIndexOffset);
    indexOffset = indexOffset - filterStartIndexOffset;
  }

  const excluded = computeSelectionResultRelativeToFilter
    ? allExcluded.filter((x) => {
        const isExcludedIndex = allowedDaysOfWeek.has(indexDayOfWeek(x)); // ???
        return isExcludedIndex;
      })
    : allExcluded;

  const offsetExcluded: DateCellIndex[] = excluded.map((x) => x - indexOffset); // set to the proper offset

  const ex = [...filterOffsetExcludedRange, ...offsetExcluded];

  const w: DateCellScheduleEncodedWeek = dateCellScheduleEncodedWeek(effectiveScheduleDays);
  const d: DateCellIndex[] = []; // "included" blocks are never used/calculated.

  // Always ensure the end is after or equal to the start.
  if (isBefore(end, start)) {
    end = start; // end is start
  }

  const dateScheduleRange: DateCellScheduleDateRange = {
    timezone,
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

/**
 * The selected date range and the corresponding cell range.
 */
export interface CalendarScheduleSelectionRangeAndExclusion extends DateRange {
  /**
   * Corresponds to the start and end indexes in the date range.
   */
  dateCellRange: DateCellRangeWithRange;
  /**
   * All excluded indexes.
   */
  excluded: DateCellIndex[];
}

export function computeScheduleSelectionRangeAndExclusion(state: CalendarScheduleSelectionState): Maybe<CalendarScheduleSelectionRangeAndExclusion> {
  const { start: currentStart, isEnabledDay, isEnabledFilterDay, systemTimezone } = state;

  const dateFactory = dateCellTimingStartDateFactory({ startsAt: currentStart, timezone: systemTimezone });
  const dateCellRange = computeCalendarScheduleSelectionDateCellRange(state);

  if (dateCellRange == null) {
    return null; // returns null if no items are selected.
  }

  const start = dateFactory(dateCellRange.i);
  const end = dateFactory(dateCellRange.to);

  const excluded: DateCellIndex[] = range(dateCellRange.i, dateCellRange.to + 1).filter((x) => {
    const isExcludedIndex = !isEnabledDay(x) || !isEnabledFilterDay(x);
    return isExcludedIndex;
  });

  const result: CalendarScheduleSelectionRangeAndExclusion = {
    dateCellRange,
    start,
    end,
    excluded
  };

  return result;
}

export function computeCalendarScheduleSelectionRange(state: CalendarScheduleSelectionState): Maybe<DateRange> {
  const dateFactory = dateCellTimingDateFactory({ startsAt: state.start, timezone: state.systemTimezone });
  const dateCellRange = computeCalendarScheduleSelectionDateCellRange(state);
  const dateRange: Maybe<DateRange> = dateCellRange != null ? { start: dateFactory(dateCellRange.i), end: dateFactory(dateCellRange.to as number) } : undefined;
  return dateRange;
}

export function computeCalendarScheduleSelectionDateCellRange(state: CalendarScheduleSelectionState): Maybe<DateCellRangeWithRange> {
  const { allowedDaysOfWeek, indexFactory, inputStart, inputEnd, indexDayOfWeek, isEnabledDay, isEnabledFilterDay } = state;
  const enabledExclusionIndexes = Array.from(state.toggledIndexes).filter((i) => allowedDaysOfWeek.has(indexDayOfWeek(i)));
  const minAndMaxSelectedValues = minAndMaxNumber(enabledExclusionIndexes);

  let startRange: Maybe<DateCellIndex>;
  let endRange: Maybe<DateCellIndex>;

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
