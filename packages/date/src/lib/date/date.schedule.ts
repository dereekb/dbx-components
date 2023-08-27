import { StringOrder, Maybe, mergeArrayIntoArray, firstValueFromIterable, DayOfWeek, addToSet, range, DecisionFunction, FilterFunction, IndexRange, invertFilter, dayOfWeek, enabledDaysFromDaysOfWeek, EnabledDays, daysOfWeekFromEnabledDays, iterablesAreSetEquivalent, ArrayOrValue, asArray, forEachInIterable, mergeFilterFunctions } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsString, Matches, IsOptional, Min, IsArray } from 'class-validator';
import { getDay } from 'date-fns';
import { copyHoursAndMinutesFromDate } from './date';
import {
  changeTimingToSystemTimezone,
  changeTimingToTimezone,
  DateBlock,
  dateBlockDayOfWeekFactory,
  DateBlockDurationSpan,
  DateBlockIndex,
  dateBlockIndexRange,
  DateBlockRange,
  DateBlockRangeOrDateRange,
  DateBlockRangeWithRange,
  DateBlocksExpansionFactory,
  dateBlocksExpansionFactory,
  dateBlockTiming,
  DateBlockTiming,
  DateBlockTimingStartEndRange,
  dateBlockTimingStartForNowInSystemTimezone,
  dateBlockTimingStartForNowInTimezone,
  dateBlockTimingRelativeIndexFactory,
  DateBlockTimingRelativeIndexFactoryInput,
  getCurrentDateBlockTimingStartDate,
  groupToDateBlockRanges,
  safeDateBlockTimingFromDateRangeAndEvent
} from './date.block';
import { dateBlockDurationSpanHasNotStartedFilterFunction, dateBlockDurationSpanHasNotEndedFilterFunction, dateBlockDurationSpanHasEndedFilterFunction, dateBlockDurationSpanHasStartedFilterFunction } from './date.filter';
import { DateRange, isSameDateRange } from './date.range';
import { copyHoursAndMinutesFromDateWithTimezoneNormal } from './date.timezone';
import { YearWeekCodeConfig, yearWeekCodeDateTimezoneInstance } from './date.week';

export enum DateScheduleDayCode {
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

export function fullWeekDayScheduleDayCodes() {
  return [DateScheduleDayCode.WEEKDAY, DateScheduleDayCode.WEEKEND];
}

export function weekdayDateScheduleDayCodes() {
  return [DateScheduleDayCode.MONDAY, DateScheduleDayCode.TUESDAY, DateScheduleDayCode.WEDNESDAY, DateScheduleDayCode.THURSDAY, DateScheduleDayCode.FRIDAY];
}

export function weekendDateScheduleDayCodes() {
  return [DateScheduleDayCode.SATURDAY, DateScheduleDayCode.SUNDAY];
}

/**
 * Creates an EnabledDays from the input.
 *
 * @param input
 * @returns
 */
export function enabledDaysFromDateScheduleDayCodes(input: Maybe<Iterable<DateScheduleDayCode>>): EnabledDays {
  const days = expandDateScheduleDayCodesToDayOfWeekSet(Array.from(new Set(input)));
  return enabledDaysFromDaysOfWeek(days);
}

/**
 * Creates an array of simplified DateScheduleDayCode[] values from the input.
 *
 * @param input
 * @returns
 */
export function dateScheduleDayCodesFromEnabledDays(input: Maybe<EnabledDays>): DateScheduleDayCode[] {
  const days = daysOfWeekFromEnabledDays(input);
  const scheduleDayCodes = days.map((x) => x + 1);
  return simplifyDateScheduleDayCodes(scheduleDayCodes);
}

/**
 * Encoded days of the week that the job block schedule should contain.
 */
export type DateScheduleEncodedWeek = '' | StringOrder<`${DateScheduleDayCode}`, ''>;

export const DATE_SCHEDULE_ENCODED_WEEK_REGEX = /^[0-9]{0,9}$/;

/**
 * Returns true if the input is a DateScheduleEncodedWeek.
 *
 * @param input
 * @returns
 */
export function isDateScheduleEncodedWeek(input: string): input is DateScheduleEncodedWeek {
  return DATE_SCHEDULE_ENCODED_WEEK_REGEX.test(input);
}

/**
 * Returns true if the input string represents an empty DateScheduleEncodedWeek.
 *
 * @param input
 * @returns
 */
export function isEmptyDateScheduleEncodedWeek(input: string): input is DateScheduleEncodedWeek {
  return input === '' || input === '0';
}

/**
 * Creates a DateScheduleEncodedWeek from an array of DateScheduleDayCode values.
 *
 * The returned encoded week is simplified.
 *
 * @param codes
 */
export function dateScheduleEncodedWeek(codes: Iterable<DateScheduleDayCode>): DateScheduleEncodedWeek {
  const result = simplifyDateScheduleDayCodes(codes);
  return result.join('') as DateScheduleEncodedWeek;
}

/**
 * Reduces/merges any day codes into more simplified day codes.
 *
 * For instance, if all days of the week are selected, they will be reduced to "8".
 *
 * @param codes
 * @returns
 */
export function simplifyDateScheduleDayCodes(codes: Iterable<DateScheduleDayCode>): DateScheduleDayCode[] {
  const codesSet = new Set(codes);
  const result: DateScheduleDayCode[] = [];

  if (codesSet.size >= 2) {
    let weekDays: Maybe<DateScheduleDayCode[]>;
    let hasAllWeekDays: boolean = codesSet.has(DateScheduleDayCode.WEEKDAY);

    if (!hasAllWeekDays) {
      weekDays = range(DateScheduleDayCode.MONDAY, DateScheduleDayCode.SATURDAY).filter((code) => codesSet.has(code));
      hasAllWeekDays = weekDays.length === 5;
    }

    const hasSaturday = codesSet.has(DateScheduleDayCode.SATURDAY);
    const hasSunday = codesSet.has(DateScheduleDayCode.SUNDAY);
    const hasAllWeekendDays: boolean = codesSet.has(DateScheduleDayCode.WEEKEND) || (hasSaturday && hasSunday);

    if (!hasAllWeekendDays && hasSunday) {
      result.push(DateScheduleDayCode.SUNDAY);
    }

    if (!hasAllWeekDays) {
      mergeArrayIntoArray(result, weekDays as DateScheduleDayCode[]);
    }

    if (!hasAllWeekendDays && hasSaturday) {
      result.push(DateScheduleDayCode.SATURDAY);
    }

    if (hasAllWeekDays) {
      result.push(DateScheduleDayCode.WEEKDAY);
    }

    if (hasAllWeekendDays) {
      result.push(DateScheduleDayCode.WEEKEND);
    }
  } else {
    const only = firstValueFromIterable(codesSet);

    if (only) {
      result.push(only);
    }
  }

  return result;
}

export type DateScheduleDayCodesInput = DateScheduleEncodedWeek | ArrayOrValue<DateScheduleDayCode> | Set<DateScheduleDayCode>;

/**
 * Expands the input DateScheduleDayCodesInput to a Set of DayOfWeek values.
 *
 * @param input
 * @returns
 */
export function expandDateScheduleDayCodesToDayOfWeekSet(input: DateScheduleDayCodesInput): Set<DayOfWeek> {
  const days = new Set<DayOfWeek>();
  const dayCodesSet = expandDateScheduleDayCodesToDayCodesSet(input);

  forEachInIterable(dayCodesSet, (code) => {
    days.add((code - 1) as DayOfWeek);
  });

  return days;
}

export function dateScheduleDayCodesSetFromDaysOfWeek(input: Iterable<DayOfWeek>): Set<DateScheduleDayCode> {
  const codes = new Set<DateScheduleDayCode>();

  forEachInIterable(input, (code) => {
    codes.add((code + 1) as DateScheduleDayCode);
  });

  return codes;
}

/**
 * Expands the input into an array of DateScheduleDayCode values.
 *
 * @param input
 * @returns
 */
export function expandDateScheduleDayCodes(input: DateScheduleDayCodesInput): DateScheduleDayCode[] {
  return Array.from(expandDateScheduleDayCodesToDayCodesSet(input));
}

/**
 * Expands the input DateScheduleDayCodesInput to a Set of DayOfWeek values.
 *
 * @param input
 * @returns
 */
export function expandDateScheduleDayCodesToDayCodesSet(input: DateScheduleDayCodesInput): Set<DateScheduleDayCode> {
  const codes: DateScheduleDayCode[] = rawDateScheduleDayCodes(input);
  const days = new Set<DateScheduleDayCode>();

  codes.forEach((code) => {
    switch (code) {
      case 0:
        // do nothing
        break;
      case 8:
        addToSet(days, weekdayDateScheduleDayCodes()); // monday-friday
        break;
      case 9:
        addToSet(days, weekendDateScheduleDayCodes());
        break;
      default: // remove offset
        days.add(code);
        break;
    }
  });

  return days;
}

/**
 * Converts the input DateScheduleDayCodesInput to an array of DateScheduleDayCode values, but does not expand
 *
 * @param input
 * @returns
 */
export function rawDateScheduleDayCodes(input: DateScheduleDayCodesInput): DateScheduleDayCode[] {
  let dayCodes: DateScheduleDayCode[];

  switch (typeof input) {
    case 'string':
      dayCodes = Array.from(new Set(input)).map((x) => Number(x)) as DateScheduleDayCode[];
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
 * Used to convert the input dates into a DateScheduleDayCode.
 */
export type DateScheduleDayCodeFactory = (date: Date) => DateScheduleDayCode;

export type DateScheduleDayCodeConfig = Pick<YearWeekCodeConfig, 'timezone'>;

/**
 * Creates a DateScheduleDayCodeFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function dateScheduleDayCodeFactory(config?: DateScheduleDayCodeConfig): DateScheduleDayCodeFactory {
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
export function dateScheduleDayCodesAreSetsEquivalent(a: DateScheduleDayCodesInput, b: DateScheduleDayCodesInput): boolean {
  const ae = expandDateScheduleDayCodes(a);
  const be = expandDateScheduleDayCodes(b);
  return iterablesAreSetEquivalent(ae, be);
}

// MARK: DateSchedule
/**
 * Scheduled used to filter to disable DateBlock values for a job.
 */
export interface DateSchedule {
  /**
   * Days of the week to include.
   */
  w: DateScheduleEncodedWeek;
  /**
   * Specific DateBlockIndex values to include.
   */
  d?: DateBlockIndex[];
  /**
   * Specific DateBlockIndex values to exclude.
   */
  ex?: DateBlockIndex[];
}

export function isSameDateSchedule(a: Maybe<DateSchedule>, b: Maybe<DateSchedule>): boolean {
  if (a && b) {
    return a.w === b.w && iterablesAreSetEquivalent(a.ex, b.ex) && iterablesAreSetEquivalent(a.d, b.d);
  } else {
    return a == b;
  }
}

export class DateSchedule implements DateSchedule {
  @Expose()
  @IsString()
  @Matches(DATE_SCHEDULE_ENCODED_WEEK_REGEX)
  w!: DateScheduleEncodedWeek;

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  d?: DateBlockIndex[];

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  ex?: DateBlockIndex[];

  constructor(template?: DateSchedule) {
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
export interface DateScheduleRange extends DateSchedule, DateBlockTimingStartEndRange {}

/**
 * Returns true if both inputs have the same schedule and date range.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameDateScheduleRange(a: Maybe<DateScheduleRange>, b: Maybe<DateScheduleRange>): boolean {
  if (a && b) {
    return isSameDateRange(a, b) && isSameDateSchedule(a, b);
  } else {
    return a == b;
  }
}

/**
 * Creates a DateBlockTiming for the input DateScheduleRange
 *
 * @param dateScheduleRange
 * @param duration
 * @param startsAtTime
 * @returns
 */
export function dateBlockTimingForDateScheduleRange(dateScheduleRange: DateScheduleRange, duration: number, startsAtTime?: Date): DateBlockTiming {
  const { start } = dateScheduleRange;
  const timing: DateBlockTiming = safeDateBlockTimingFromDateRangeAndEvent(dateScheduleRange, { startsAt: startsAtTime ?? start, duration });
  return timing;
}

// MARK: DateScheduleDate
/**
 * DateScheduleDateFilter input.
 */
export type DateScheduleDateFilterInput = DateBlockTimingRelativeIndexFactoryInput;

/**
 * Returns true if the date falls within the schedule.
 */
export type DateScheduleDateFilter = DecisionFunction<DateScheduleDateFilterInput>;

/**
 * dateScheduleDateFilter() configuration.
 *
 * The input date range is a DateBlockTimingStartEndRange, where the start date is expected to be a DateBlockTimingStart.
 */
export interface DateScheduleDateFilterConfig extends DateSchedule, Partial<DateBlockTimingStartEndRange> {
  minMaxDateRange?: Maybe<Partial<DateBlockRangeOrDateRange>>;
  /**
   * Whether or not to restrict the start as the min date if a min date is not set in minMaxDateRange. True by default.
   */
  setStartAsMinDate?: boolean;
}

export function copyDateScheduleDateFilterConfig(inputFilter: DateScheduleDateFilterConfig): DateScheduleDateFilterConfig {
  return {
    start: inputFilter.start,
    end: inputFilter.end,
    w: inputFilter.w,
    d: inputFilter.d,
    ex: inputFilter.ex
  };
}

/**
 * Creates a DateScheduleDateFilter.
 *
 * @param config
 * @returns
 */
export function dateScheduleDateFilter(config: DateScheduleDateFilterConfig): DateScheduleDateFilter {
  const { w, start: inputStart, setStartAsMinDate = true, end, minMaxDateRange } = config;
  const timingStart = inputStart != null ? changeTimingToSystemTimezone({ start: inputStart }) : dateBlockTimingStartForNowInSystemTimezone();
  const { start: firstDate } = timingStart;

  const allowedDays: Set<DayOfWeek> = expandDateScheduleDayCodesToDayOfWeekSet(w);

  // Start date is either now or the filter's start date. It is never the minMax's start date, since that is irrelevant to the filter's range.

  const firstDateDay = getDay(firstDate);
  const dayForIndex = dateBlockDayOfWeekFactory(firstDateDay);
  const dateIndexForDate = dateBlockTimingRelativeIndexFactory(timingStart);

  const indexFloor = setStartAsMinDate ? 0 : Number.MIN_SAFE_INTEGER;
  const minAllowedIndex = minMaxDateRange?.start != null ? Math.max(indexFloor, dateIndexForDate(minMaxDateRange.start)) : indexFloor; // start date should be the min inde
  const maxAllowedIndex = end != null ? dateIndexForDate(end) : minMaxDateRange?.end != null ? dateIndexForDate(minMaxDateRange.end) : Number.MAX_SAFE_INTEGER; // max "to" value

  const includedIndexes = new Set(config.d);
  const excludedIndexes = new Set(config.ex);

  return (input: DateScheduleDateFilterInput) => {
    let i: DateBlockIndex;
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

// MARK: DateScheduleDateBlockTimingFilter
export type DateScheduleDateBlockTimingFilter<B extends DateBlock = DateBlock> = DecisionFunction<B>;

/**
 * Configuration for dateScheduleDateBlockTimingFilter()
 */
export interface DateScheduleDateBlockTimingFilterConfig {
  /**
   * Timing to filter with.
   */
  timing: DateBlockTiming;
  /**
   * Schedule to filter with.
   */
  schedule: DateSchedule;
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
  durationSpanFilter?: FilterFunction<DateBlockDurationSpan<DateBlock>>;
  /**
   * (Optional) Maximum number of blocks to return.
   */
  maxDateBlocksToReturn?: number;
}

/**
 * Creates a DateScheduleDateBlockTimingFilter.
 *
 * @param param0
 * @returns
 */
export function dateScheduleDateBlockTimingFilter<B extends DateBlock = DateBlock>({ timing, schedule }: DateScheduleDateBlockTimingFilterConfig): DateScheduleDateBlockTimingFilter<B> {
  const isAllowed = dateScheduleDateFilter({
    w: schedule.w,
    d: schedule.d,
    ex: schedule.ex,
    start: getCurrentDateBlockTimingStartDate(timing) // start date in the current system timezone.
  });

  return (block: Readonly<B>) => {
    const i = block.i;
    return isAllowed(i);
  };
}

/**
 * Creates a DateBlocksExpansionFactory using the input DateScheduleDateBlockTimingFilterConfig.
 *
 * @param config
 * @returns
 */
export function expandDateScheduleFactory<B extends DateBlock = DateBlock>(config: DateScheduleDateBlockTimingFilterConfig): DateBlocksExpansionFactory<B> {
  const { invertSchedule = false, now, onlyBlocksThatHaveEnded, onlyBlocksThatHaveStarted, onlyBlocksNotYetEnded, onlyBlocksNotYetStarted, maxDateBlocksToReturn, durationSpanFilter: inputDurationSpanFilter } = config;
  let durationSpanFilter: FilterFunction<DateBlockDurationSpan<DateBlock>> | undefined;
  let durationSpanFilters: FilterFunction<DateBlockDurationSpan<DateBlock>>[] = [];

  if (inputDurationSpanFilter) {
    durationSpanFilters.push(inputDurationSpanFilter);
  }

  if (onlyBlocksNotYetStarted) {
    durationSpanFilters.push(dateBlockDurationSpanHasNotStartedFilterFunction(now));
  } else if (onlyBlocksThatHaveEnded) {
    durationSpanFilters.push(dateBlockDurationSpanHasEndedFilterFunction(now));
  } else {
    if (onlyBlocksThatHaveStarted) {
      durationSpanFilters.push(dateBlockDurationSpanHasStartedFilterFunction(now));
    }

    if (onlyBlocksNotYetEnded) {
      durationSpanFilters.push(dateBlockDurationSpanHasNotEndedFilterFunction(now));
    }
  }

  durationSpanFilter = mergeFilterFunctions(...durationSpanFilters);

  const expansionFactory = dateBlocksExpansionFactory<B>({
    timing: config.timing,
    filter: invertFilter(dateScheduleDateBlockTimingFilter(config) as FilterFunction, invertSchedule), // TODO: Use invertDecision
    durationSpanFilter,
    maxDateBlocksToReturn
  });

  return expansionFactory;
}

export interface ExpandDateScheduleInput extends DateScheduleDateBlockTimingFilterConfig {
  inputRange?: IndexRange;
}

/**
 * Expands the input DateBlockTiming and DateSchedule into an array of DateBlockDurationSpan value that correspond with blocks in the event.
 *
 * Can optionally provide an IndexRange to specify a specific range to filter on. The range will be capped to the range of the timing.
 *
 * @param timing
 * @param schedule
 * @param inputRange
 * @returns
 */
export function expandDateSchedule(input: ExpandDateScheduleInput): DateBlockDurationSpan<DateBlock>[] {
  const { timing, inputRange } = input;
  const expansionFactory = expandDateScheduleFactory(input);
  const completeRange = dateBlockIndexRange(timing);
  const range = inputRange ? { minIndex: Math.max(inputRange.minIndex, completeRange.minIndex), maxIndex: Math.min(inputRange.maxIndex, completeRange.maxIndex) } : completeRange;
  const dateBlockForRange: DateBlockRange = {
    i: range.minIndex,
    to: range.maxIndex
  }; // Index is considered to be used as inclusive already, so no need to use dateBlockIndexRangeToDateBlockRange

  return expansionFactory([dateBlockForRange]);
}

/**
 * Input for ExpandDateScheduleRangeInput
 */
export interface ExpandDateScheduleRangeInput extends Omit<DateScheduleDateBlockTimingFilterConfig, 'schedule' | 'timing'> {
  readonly dateScheduleRange: DateScheduleRange;
  /**
   * Duration of the timing.
   */
  readonly duration: number;
  /**
   * (Optional) Hours/Minutes to copy from. Note, this will modify the timing's end date to be a valid time.
   */
  readonly startsAtTime?: Date;
}

// dateBlockTimingForDateScheduleRange

/**
 * Creates a DateBlockTiming for the input ExpandDateScheduleRangeInput.
 *
 * @param input
 * @returns
 */
export function dateBlockTimingForExpandDateScheduleRangeInput(input: ExpandDateScheduleRangeInput): DateBlockTiming {
  const { dateScheduleRange, duration, startsAtTime } = input;
  return dateBlockTimingForDateScheduleRange(dateScheduleRange, duration, startsAtTime);
}

/**
 *
 * @param input
 * @returns
 */
export function expandDateScheduleRange(input: ExpandDateScheduleRangeInput): DateBlockDurationSpan<DateBlock>[] {
  const { dateScheduleRange } = input;
  const timing = dateBlockTimingForExpandDateScheduleRangeInput(input);
  return expandDateSchedule({ ...input, schedule: dateScheduleRange, timing });
}

// MARK: DateScheduleRange
export type ExpandDateScheduleRangeToDateBlockRangeInput = ExpandDateScheduleRangeInput;

export function expandDateScheduleRangeToDateBlockRanges(input: ExpandDateScheduleRangeToDateBlockRangeInput): DateBlockRangeWithRange[] {
  const dateBlockDurationSpans = expandDateScheduleRange(input);
  return groupToDateBlockRanges(dateBlockDurationSpans);
}

// MARK: Compat
/**
 * Converts the input DateScheduleDayCodesInput to an array of DateScheduleDayCode values.
 *
 * @param input
 * @returns
 *
 * @deprecated Use expandDateScheduleDayCodes or rawDateScheduleDayCodes depending on the need case.
 */
export const dateScheduleDayCodes = expandDateScheduleDayCodes;

/**
 * Expands a DateScheduleEncodedWeek to an array of DateScheduleDayCode valeus.
 *
 * @param week
 * @returns
 *
 * @deprecated Use expandDateScheduleDayCodes instead.
 */
export const expandDateScheduleEncodedWeek = expandDateScheduleDayCodes;
