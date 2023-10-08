import { StringOrder, Maybe, mergeArrayIntoArray, firstValueFromIterable, DayOfWeek, addToSet, range, DecisionFunction, FilterFunction, IndexRange, invertFilter, enabledDaysFromDaysOfWeek, EnabledDays, daysOfWeekFromEnabledDays, iterablesAreSetEquivalent, ArrayOrValue, forEachInIterable, mergeFilterFunctions, TimezoneString } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsString, Matches, IsOptional, Min, IsArray } from 'class-validator';
import { getDay } from 'date-fns';
import { requireCurrentTimezone } from './date';
import { calculateExpectedDateCellTimingDurationPair, DateCell, DateCellDurationSpan, DateCellIndex, DateCellTiming, DateCellTimingStartsAtEndRange, FullDateCellTiming } from './date.cell';
import { DateCellTimingRelativeIndexFactoryInput, dateCellTimingRelativeIndexFactory, DateCellTimingExpansionFactory, dateCellTimingExpansionFactory, dateCellIndexRange, updateDateCellTimingWithDateCellTimingEvent } from './date.cell.factory';
import { dateCellDurationSpanHasNotStartedFilterFunction, dateCellDurationSpanHasNotEndedFilterFunction, dateCellDurationSpanHasEndedFilterFunction, dateCellDurationSpanHasStartedFilterFunction } from './date.cell.filter';
import { DateCellRangeOrDateRange, DateCellRange, DateCellRangeWithRange, groupToDateCellRanges } from './date.cell.index';
import { dateCellDayOfWeekFactory } from './date.cell.week';
import { isSameDateRange } from './date.range';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance } from './date.timezone';
import { YearWeekCodeConfig, yearWeekCodeDateTimezoneInstance } from './date.week';

export enum DateCellScheduleDayCode {
  /**
   * Special no-op/unused code
   */
  NONE = 0,
  SUNDAY = 1, // Day.SUNDAY + 1
  MONDAY = 2,
  TUESDAY = 3,
  WEDNESDAY = 4,
  THURSDAY = 5,
  FRIDAY = 6,
  SATURDAY = 7,
  /**
   * All weekdays (Mon-Fri)
   */
  WEEKDAY = 8,
  /**
   * All weekend days (Sat/Sun)
   */
  WEEKEND = 9
}

export function fullWeekDateCellScheduleDayCodes() {
  return [DateCellScheduleDayCode.WEEKDAY, DateCellScheduleDayCode.WEEKEND];
}

export function weekdayDateCellScheduleDayCodes() {
  return [DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.TUESDAY, DateCellScheduleDayCode.WEDNESDAY, DateCellScheduleDayCode.THURSDAY, DateCellScheduleDayCode.FRIDAY];
}

export function weekendDateCellScheduleDayCodes() {
  return [DateCellScheduleDayCode.SATURDAY, DateCellScheduleDayCode.SUNDAY];
}

/**
 * Creates an EnabledDays from the input.
 *
 * @param input
 * @returns
 */
export function enabledDaysFromDateCellScheduleDayCodes(input: Maybe<Iterable<DateCellScheduleDayCode>>): EnabledDays {
  const days = expandDateCellScheduleDayCodesToDayOfWeekSet(Array.from(new Set(input)));
  return enabledDaysFromDaysOfWeek(days);
}

/**
 * Creates an array of simplified DateCellScheduleDayCode[] values from the input.
 *
 * @param input
 * @returns
 */
export function dateCellScheduleDayCodesFromEnabledDays(input: Maybe<EnabledDays>): DateCellScheduleDayCode[] {
  const days = daysOfWeekFromEnabledDays(input);
  const scheduleDayCodes = days.map((x) => x + 1);
  return simplifyDateCellScheduleDayCodes(scheduleDayCodes);
}

/**
 * Encoded days of the week that the job block schedule should contain.
 */
export type DateCellScheduleEncodedWeek = '' | StringOrder<`${DateCellScheduleDayCode}`, ''>;

export const DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX = /^[0-9]{0,9}$/;

/**
 * Returns true if the input is a DateCellScheduleEncodedWeek.
 *
 * @param input
 * @returns
 */
export function isDateCellScheduleEncodedWeek(input: string): input is DateCellScheduleEncodedWeek {
  return DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX.test(input);
}

/**
 * Returns true if the input string represents an empty DateCellScheduleEncodedWeek.
 *
 * @param input
 * @returns
 */
export function isEmptyDateCellScheduleEncodedWeek(input: string): input is DateCellScheduleEncodedWeek {
  return input === '' || input === '0';
}

/**
 * Creates a DateCellScheduleEncodedWeek from an array of DateCellScheduleDayCode values.
 *
 * The returned encoded week is simplified.
 *
 * @param codes
 */
export function dateCellScheduleEncodedWeek(codes: Iterable<DateCellScheduleDayCode>): DateCellScheduleEncodedWeek {
  const result = simplifyDateCellScheduleDayCodes(codes);
  return result.join('') as DateCellScheduleEncodedWeek;
}

/**
 * Reduces/merges any day codes into more simplified day codes.
 *
 * For instance, if all days of the week are selected, they will be reduced to "8".
 *
 * @param codes
 * @returns
 */
export function simplifyDateCellScheduleDayCodes(codes: Iterable<DateCellScheduleDayCode>): DateCellScheduleDayCode[] {
  const codesSet = new Set(codes);
  const result: DateCellScheduleDayCode[] = [];

  if (codesSet.size >= 2) {
    let weekDays: Maybe<DateCellScheduleDayCode[]>;
    let hasAllWeekDays: boolean = codesSet.has(DateCellScheduleDayCode.WEEKDAY);

    if (!hasAllWeekDays) {
      weekDays = range(DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.SATURDAY).filter((code) => codesSet.has(code));
      hasAllWeekDays = weekDays.length === 5;
    }

    const hasSaturday = codesSet.has(DateCellScheduleDayCode.SATURDAY);
    const hasSunday = codesSet.has(DateCellScheduleDayCode.SUNDAY);
    const hasAllWeekendDays: boolean = codesSet.has(DateCellScheduleDayCode.WEEKEND) || (hasSaturday && hasSunday);

    if (!hasAllWeekendDays && hasSunday) {
      result.push(DateCellScheduleDayCode.SUNDAY);
    }

    if (!hasAllWeekDays) {
      mergeArrayIntoArray(result, weekDays as DateCellScheduleDayCode[]);
    }

    if (!hasAllWeekendDays && hasSaturday) {
      result.push(DateCellScheduleDayCode.SATURDAY);
    }

    if (hasAllWeekDays) {
      result.push(DateCellScheduleDayCode.WEEKDAY);
    }

    if (hasAllWeekendDays) {
      result.push(DateCellScheduleDayCode.WEEKEND);
    }
  } else {
    const only = firstValueFromIterable(codesSet);

    if (only) {
      result.push(only);
    }
  }

  return result;
}

export type DateCellScheduleDayCodesInput = DateCellScheduleEncodedWeek | ArrayOrValue<DateCellScheduleDayCode> | Set<DateCellScheduleDayCode>;

/**
 * Expands the input DateCellScheduleDayCodesInput to a Set of DayOfWeek values.
 *
 * @param input
 * @returns
 */
export function expandDateCellScheduleDayCodesToDayOfWeekSet(input: DateCellScheduleDayCodesInput): Set<DayOfWeek> {
  const days = new Set<DayOfWeek>();
  const dayCodesSet = expandDateCellScheduleDayCodesToDayCodesSet(input);

  forEachInIterable(dayCodesSet, (code) => {
    days.add((code - 1) as DayOfWeek);
  });

  return days;
}

export function dateCellScheduleDayCodesSetFromDaysOfWeek(input: Iterable<DayOfWeek>): Set<DateCellScheduleDayCode> {
  const codes = new Set<DateCellScheduleDayCode>();

  forEachInIterable(input, (code) => {
    codes.add((code + 1) as DateCellScheduleDayCode);
  });

  return codes;
}

/**
 * Expands the input into an array of DateCellScheduleDayCode values.
 *
 * @param input
 * @returns
 */
export function expandDateCellScheduleDayCodes(input: DateCellScheduleDayCodesInput): DateCellScheduleDayCode[] {
  return Array.from(expandDateCellScheduleDayCodesToDayCodesSet(input));
}

/**
 * Expands the input DateCellScheduleDayCodesInput to a Set of DayOfWeek values.
 *
 * @param input
 * @returns
 */
export function expandDateCellScheduleDayCodesToDayCodesSet(input: DateCellScheduleDayCodesInput): Set<DateCellScheduleDayCode> {
  const codes: DateCellScheduleDayCode[] = rawDateCellScheduleDayCodes(input);
  const days = new Set<DateCellScheduleDayCode>();

  codes.forEach((code) => {
    switch (code) {
      case 0:
        // do nothing
        break;
      case 8:
        addToSet(days, weekdayDateCellScheduleDayCodes()); // monday-friday
        break;
      case 9:
        addToSet(days, weekendDateCellScheduleDayCodes());
        break;
      default: // remove offset
        days.add(code);
        break;
    }
  });

  return days;
}

/**
 * Converts the input DateCellScheduleDayCodesInput to an array of DateCellScheduleDayCode values, but does not expand
 *
 * @param input
 * @returns
 */
export function rawDateCellScheduleDayCodes(input: DateCellScheduleDayCodesInput): DateCellScheduleDayCode[] {
  let dayCodes: DateCellScheduleDayCode[];

  switch (typeof input) {
    case 'string':
      dayCodes = Array.from(new Set(input)).map((x) => Number(x)) as DateCellScheduleDayCode[];
      break;
    case 'number':
      dayCodes = [input];
      break;
    default:
      dayCodes = Array.from(input);
      break;
  }

  return dayCodes.filter((x) => Boolean(x)); // filter out "none" code
}

/**
 * Used to convert the input dates into a DateCellScheduleDayCode.
 */
export type DateCellScheduleDayCodeFactory = (date: Date) => DateCellScheduleDayCode;

export type DateCellScheduleDayCodeConfig = Pick<YearWeekCodeConfig, 'timezone'>;

/**
 * Creates a DateCellScheduleDayCodeFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function dateCellScheduleDayCodeFactory(config?: DateCellScheduleDayCodeConfig): DateCellScheduleDayCodeFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);
  return (date: Date) => {
    const target = normal.systemDateToTargetDate(date);
    const day = getDay(target);
    return day + 1;
  };
}

/**
 * Returns true if the input codes, when expanded, are equivalent.
 *
 * @param a
 * @param b
 * @returns
 */
export function dateCellScheduleDayCodesAreSetsEquivalent(a: DateCellScheduleDayCodesInput, b: DateCellScheduleDayCodesInput): boolean {
  const ae = expandDateCellScheduleDayCodes(a);
  const be = expandDateCellScheduleDayCodes(b);
  return iterablesAreSetEquivalent(ae, be);
}

// MARK: DateCellSchedule
/**
 * Scheduled used to filter to disable DateCell values for a job.
 */
export interface DateCellSchedule {
  /**
   * Days of the week to include.
   */
  w: DateCellScheduleEncodedWeek;
  /**
   * Specific DateCellIndex values to include.
   */
  d?: DateCellIndex[];
  /**
   * Specific DateCellIndex values to exclude.
   */
  ex?: DateCellIndex[];
}

export function isSameDateCellSchedule(a: Maybe<DateCellSchedule>, b: Maybe<DateCellSchedule>): boolean {
  if (a && b) {
    return a.w === b.w && iterablesAreSetEquivalent(a.ex, b.ex) && iterablesAreSetEquivalent(a.d, b.d);
  } else {
    return a == b;
  }
}

export class DateCellSchedule implements DateCellSchedule {
  @Expose()
  @IsString()
  @Matches(DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX)
  w!: DateCellScheduleEncodedWeek;

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  d?: DateCellIndex[];

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  ex?: DateCellIndex[];

  constructor(template?: DateCellSchedule) {
    if (template) {
      this.w = template.w;
      this.d = template.d;
      this.ex = template.ex;
    }
  }
}

/**
 * A schedule that occurs during a specific range.
 */
export interface DateCellScheduleRange extends DateCellSchedule, DateCellTimingStartsAtEndRange {}

/**
 * Returns true if both inputs have the same schedule and date range.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameDateCellScheduleRange(a: Maybe<DateCellScheduleRange>, b: Maybe<DateCellScheduleRange>): boolean {
  if (a && b) {
    return isSameDateRange(a, b) && isSameDateCellSchedule(a, b);
  } else {
    return a == b;
  }
}

/**
 * Creates a DateCellTiming for the input DateCellScheduleRange.
 *
 * The Timezone the timing is in is recommended. If not provided, may produce incorrect results when dealing with daylight savings time changes.
 *
 * @param dateCellScheduleRange
 * @param duration
 * @param startsAtTime
 * @param timezone
 * @returns
 */
export function dateCellTimingForDateCellScheduleRange(dateCellScheduleRange: DateCellScheduleRange, duration: number, startsAtTime?: Date): DateCellTiming;
export function dateCellTimingForDateCellScheduleRange(dateCellScheduleRange: DateCellScheduleRange, duration: number, startsAtTime?: Date): DateCellTiming {
  const timing: DateCellTiming = updateDateCellTimingWithDateCellTimingEvent({
    timing: dateCellScheduleRange,
    event: {
      startsAt: startsAtTime ?? dateCellScheduleRange.startsAt,
      duration
    },
    replaceStartsAt: startsAtTime != null,
    replaceDuration: true
  });

  return timing;
}

// MARK: DateCellScheduleDate
/**
 * DateCellScheduleDateFilter input.
 */
export type DateCellScheduleDateFilterInput = DateCellTimingRelativeIndexFactoryInput;

/**
 * Returns true if the date falls within the schedule.
 */
export type DateCellScheduleDateFilter = DecisionFunction<DateCellScheduleDateFilterInput>;

/**
 * dateCellScheduleDateFilter() configuration.
 */
export interface DateCellScheduleDateFilterConfig extends DateCellSchedule, Partial<DateCellTimingStartsAtEndRange> {
  minMaxDateRange?: Maybe<Partial<DateCellRangeOrDateRange>>;
  /**
   * Whether or not to restrict the start as the min date if a min date is not set in minMaxDateRange. True by default.
   */
  setStartAsMinDate?: boolean;
}

export function copyDateCellScheduleDateFilterConfig(inputFilter: DateCellScheduleDateFilterConfig): DateCellScheduleDateFilterConfig {
  return {
    startsAt: inputFilter.startsAt,
    end: inputFilter.end,
    timezone: inputFilter.timezone,
    w: inputFilter.w,
    d: inputFilter.d,
    ex: inputFilter.ex
  };
}

/**
 * Creates a DateCellScheduleDateFilter.
 *
 * @param config
 * @returns
 */
export function dateCellScheduleDateFilter(config: DateCellScheduleDateFilterConfig): DateCellScheduleDateFilter {
  const { w, startsAt: inputStartsAt, end: inputEnd, timezone: inputTimezone, setStartAsMinDate = true, minMaxDateRange } = config;

  const timezone = inputTimezone ?? requireCurrentTimezone(); // if the timezone is not provided, assume the startsAt is a system timezone normal.
  const normalInstance = dateTimezoneUtcNormal(timezone);

  // derive the startsAt time for the range. If not provided, defaults to midnight in the target timezone.
  const startsAt: Date = inputStartsAt != null ? inputStartsAt : normalInstance.startOfDayInTargetTimezone();
  const startsAtInSystem: Date = normalInstance.systemDateToTargetDate(startsAt);

  const allowedDays: Set<DayOfWeek> = expandDateCellScheduleDayCodesToDayOfWeekSet(w);

  // Start date is either now or the filter's start date. It is never the minMax's start date, since that is irrelevant to the filter's range.

  const firstDateDay = getDay(startsAtInSystem);
  const dayForIndex = dateCellDayOfWeekFactory(firstDateDay);
  const dateIndexForDate = dateCellTimingRelativeIndexFactory({ startsAt, timezone });

  let end: Maybe<Date>;

  if (inputEnd != null) {
    // use the startsAt time instead of the end time because endsAt can fall into the next day index range
    const { expectedFinalStartsAt } = calculateExpectedDateCellTimingDurationPair({ startsAt, timezone, end: inputEnd });
    end = expectedFinalStartsAt;
  }

  const indexFloor = setStartAsMinDate ? 0 : Number.MIN_SAFE_INTEGER;
  const minAllowedIndex = minMaxDateRange?.start != null ? Math.max(indexFloor, dateIndexForDate(minMaxDateRange.start)) : indexFloor; // start date should be the min inde
  const maxAllowedIndex = inputEnd != null ? dateIndexForDate(inputEnd) : minMaxDateRange?.end != null ? dateIndexForDate(minMaxDateRange.end) : Number.MAX_SAFE_INTEGER; // max "to" value

  const includedIndexes = new Set(config.d);
  const excludedIndexes = new Set(config.ex);

  return (input: DateCellScheduleDateFilterInput) => {
    let i: DateCellIndex;
    let day: DayOfWeek;

    if (typeof input === 'number') {
      i = input;
    } else {
      i = dateIndexForDate(input);
    }

    day = dayForIndex(i);
    const result = (i >= minAllowedIndex && i <= maxAllowedIndex && allowedDays.has(day) && !excludedIndexes.has(i)) || includedIndexes.has(i);
    return result;
  };
}

// MARK: DateCellScheduleDateCellTimingFilter
export type DateCellScheduleDateCellTimingFilter<B extends DateCell = DateCell> = DecisionFunction<B>;

/**
 * Configuration for dateCellScheduleDateCellTimingFilter()
 */
export interface DateCellScheduleDateCellTimingFilterConfig {
  /**
   * Timing to filter with.
   */
  timing: DateCellTiming;
  /**
   * Schedule to filter with.
   */
  schedule: DateCellSchedule;
  /**
   * Wether or not to expand on the inverse of the schedule, returning blocks that are not in the schedule.
   *
   * Other date filtering behaves the same (I.E. onlyBlocksNotYetStarted, etc.)
   */
  invertSchedule?: boolean;
  /**
   * (Optional) date to use when filtering from now.
   */
  now?: Date;
  /**
   * (Optional) filters in blocks that have not yet started. Can be combined with the other filters.
   */
  onlyBlocksThatHaveStarted?: boolean;
  /**
   * (Optional) filters in blocks that have not yet ended. Can be combined with the other filters.
   */
  onlyBlocksThatHaveEnded?: boolean;
  /**
   * (Optional) filters in blocks that have not yet started. Can be combined with the other filters.
   */
  onlyBlocksNotYetStarted?: boolean;
  /**
   * (Optional) filters in blocks that have not yet ended. Can be combined with the other filters.
   */
  onlyBlocksNotYetEnded?: boolean;
  /**
   * (Optional) custom filter function. Can be combined with the other filters.
   */
  durationSpanFilter?: FilterFunction<DateCellDurationSpan<DateCell>>;
  /**
   * (Optional) Maximum number of blocks to return.
   */
  maxDateCellsToReturn?: number;
}

/**
 * Creates a DateCellScheduleDateCellTimingFilter.
 *
 * @param param0
 * @returns
 */
export function dateCellScheduleDateCellTimingFilter<B extends DateCell = DateCell>({ timing, schedule }: DateCellScheduleDateCellTimingFilterConfig): DateCellScheduleDateCellTimingFilter<B> {
  const isAllowed = dateCellScheduleDateFilter({
    w: schedule.w,
    d: schedule.d,
    ex: schedule.ex,
    startsAt: timing.startsAt,
    end: timing.end,
    timezone: timing.timezone
  });

  return (block: Readonly<B>) => {
    const i = block.i;
    return isAllowed(i);
  };
}

/**
 * Creates a DateCellTimingExpansionFactory using the input DateCellScheduleDateCellTimingFilterConfig.
 *
 * @param config
 * @returns
 */
export function expandDateCellScheduleFactory<B extends DateCell = DateCell>(config: DateCellScheduleDateCellTimingFilterConfig): DateCellTimingExpansionFactory<B> {
  const { invertSchedule = false, now, onlyBlocksThatHaveEnded, onlyBlocksThatHaveStarted, onlyBlocksNotYetEnded, onlyBlocksNotYetStarted, maxDateCellsToReturn, durationSpanFilter: inputDurationSpanFilter } = config;
  let durationSpanFilter: FilterFunction<DateCellDurationSpan<DateCell>> | undefined;
  let durationSpanFilters: FilterFunction<DateCellDurationSpan<DateCell>>[] = [];

  if (inputDurationSpanFilter) {
    durationSpanFilters.push(inputDurationSpanFilter);
  }

  if (onlyBlocksNotYetStarted) {
    durationSpanFilters.push(dateCellDurationSpanHasNotStartedFilterFunction(now));
  } else if (onlyBlocksThatHaveEnded) {
    durationSpanFilters.push(dateCellDurationSpanHasEndedFilterFunction(now));
  } else {
    if (onlyBlocksThatHaveStarted) {
      durationSpanFilters.push(dateCellDurationSpanHasStartedFilterFunction(now));
    }

    if (onlyBlocksNotYetEnded) {
      durationSpanFilters.push(dateCellDurationSpanHasNotEndedFilterFunction(now));
    }
  }

  durationSpanFilter = mergeFilterFunctions(...durationSpanFilters);

  const expansionFactory = dateCellTimingExpansionFactory<B>({
    timing: config.timing,
    filter: invertFilter(dateCellScheduleDateCellTimingFilter(config) as FilterFunction, invertSchedule), // TODO: Use invertDecision
    durationSpanFilter,
    maxDateCellsToReturn
  });

  return expansionFactory;
}

export interface ExpandDateCellScheduleInput extends DateCellScheduleDateCellTimingFilterConfig {
  inputRange?: IndexRange;
}

/**
 * Expands the input DateCellTiming and DateCellSchedule into an array of DateCellDurationSpan value that correspond with blocks in the event.
 *
 * Can optionally provide an IndexRange to specify a specific range to filter on. The range will be capped to the range of the timing.
 *
 * @param timing
 * @param schedule
 * @param inputRange
 * @returns
 */
export function expandDateCellSchedule(input: ExpandDateCellScheduleInput): DateCellDurationSpan<DateCell>[] {
  const { timing, inputRange } = input;
  const expansionFactory = expandDateCellScheduleFactory(input);
  const completeRange = dateCellIndexRange(timing);
  const range = inputRange ? { minIndex: Math.max(inputRange.minIndex, completeRange.minIndex), maxIndex: Math.min(inputRange.maxIndex, completeRange.maxIndex) } : completeRange;
  const dateCellForRange: DateCellRange = {
    i: range.minIndex,
    to: range.maxIndex
  }; // Index is considered to be used as inclusive already, so no need to use dateCellIndexRangeToDateCellRange

  return expansionFactory([dateCellForRange]);
}

/**
 * Input for ExpandDateCellScheduleRangeInput
 */
export interface ExpandDateCellScheduleRangeInput extends Omit<DateCellScheduleDateCellTimingFilterConfig, 'schedule' | 'timing'> {
  readonly dateCellScheduleRange: DateCellScheduleRange;
  /**
   * Duration of the timing.
   */
  readonly duration: number;
  /**
   * (Optional) Hours/Minutes to copy from. Note, this will modify the timing's end date to be a valid time.
   */
  readonly startsAtTime?: Date;
  /**
   * (Recommended) Timezone the timing is in. If not provided, may produce incorrect results when dealing with daylight savings time changes.
   */
  readonly timezone?: DateTimezoneUtcNormalInstance | TimezoneString;
}

/**
 * Creates a DateCellTiming for the input ExpandDateCellScheduleRangeInput.
 *
 * @param input
 * @returns
 */
export function dateCellTimingForExpandDateCellScheduleRangeInput(input: ExpandDateCellScheduleRangeInput): DateCellTiming {
  const { dateCellScheduleRange, duration, startsAtTime } = input;
  return dateCellTimingForDateCellScheduleRange(dateCellScheduleRange, duration, startsAtTime);
}

/**
 *
 * @param input
 * @returns
 */
export function expandDateCellScheduleRange(input: ExpandDateCellScheduleRangeInput): DateCellDurationSpan<DateCell>[] {
  const { dateCellScheduleRange } = input;
  const timing = dateCellTimingForExpandDateCellScheduleRangeInput(input);
  return expandDateCellSchedule({ ...input, schedule: dateCellScheduleRange, timing });
}

// MARK: DateCellScheduleRange
export type ExpandDateCellScheduleRangeToDateCellRangeInput = ExpandDateCellScheduleRangeInput;

export function expandDateCellScheduleRangeToDateCellRanges(input: ExpandDateCellScheduleRangeToDateCellRangeInput): DateCellRangeWithRange[] {
  const dateCellDurationSpans = expandDateCellScheduleRange(input);
  return groupToDateCellRanges(dateCellDurationSpans);
}

// MARK: Compat
/**
 * Converts the input DateCellScheduleDayCodesInput to an array of DateCellScheduleDayCode values.
 *
 * @param input
 * @returns
 *
 * @deprecated Use expandDateCellScheduleDayCodes or rawDateCellScheduleDayCodes depending on the need case.
 */
export const dateCellScheduleDayCodes = expandDateCellScheduleDayCodes;

/**
 * Expands a DateCellScheduleEncodedWeek to an array of DateCellScheduleDayCode valeus.
 *
 * @param week
 * @returns
 *
 * @deprecated Use expandDateCellScheduleDayCodes instead.
 */
export const expandDateCellScheduleEncodedWeek = expandDateCellScheduleDayCodes;
