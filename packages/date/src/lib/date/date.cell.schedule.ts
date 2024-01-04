import { DateRange } from '@dereekb/date';
import { StringOrder, Maybe, pushArrayItemsIntoArray, firstValueFromIterable, DayOfWeek, addToSet, range, DecisionFunction, FilterFunction, IndexRange, invertFilter, enabledDaysFromDaysOfWeek, EnabledDays, daysOfWeekFromEnabledDays, iterablesAreSetEquivalent, ArrayOrValue, forEachInIterable, mergeFilterFunctions, TimezoneString, TimezoneStringRef, Building, sortNumbersAscendingFunction } from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsString, Matches, IsOptional, Min, IsArray } from 'class-validator';
import { getDay, addMinutes, startOfDay } from 'date-fns';
import { isDate, isSameDate, requireCurrentTimezone } from './date';
import { calculateExpectedDateCellTimingDurationPair, DateCell, DateCellDurationSpan, DateCellIndex, DateCellTiming, DateCellTimingDateRange, DateCellTimingStartsAtEndRange, FullDateCellTiming, isSameDateCellTiming, isSameFullDateCellTiming, DateCellTimingEventStartsAt, isValidDateCellTiming, isFullDateCellTiming, DateCellTimingTimezoneInput, shiftDateCellTimingToTimezoneFunction, dateCellTimingTimezoneNormalInstance } from './date.cell';
import { DateCellTimingRelativeIndexFactoryInput, dateCellTimingRelativeIndexFactory, DateCellTimingExpansionFactory, dateCellTimingExpansionFactory, dateCellIndexRange, updateDateCellTimingWithDateCellTimingEvent, dateCellTimingStartsAtDateFactory } from './date.cell.factory';
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
      pushArrayItemsIntoArray(result, weekDays as DateCellScheduleDayCode[]);
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
 * The values are sorted in ascending order.
 *
 * @param input
 * @returns
 */
export function expandDateCellScheduleDayCodes(input: DateCellScheduleDayCodesInput): DateCellScheduleDayCode[] {
  return Array.from(expandDateCellScheduleDayCodesToDayCodesSet(input)).sort(sortNumbersAscendingFunction);
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

/**
 * Returns true if the input is a DateCellSchedule.
 *
 * @param input
 * @returns
 */
export function isDateCellSchedule(input: object): input is DateCellSchedule {
  if (typeof input === 'object') {
    const asRange = input as DateCellSchedule;
    return (typeof asRange.w === 'string' && !asRange.ex) || (Array.isArray(asRange.ex) && !asRange.d) || Array.isArray(asRange.d);
  }

  return false;
}

export function isSameDateCellSchedule(a: Maybe<DateCellSchedule>, b: Maybe<DateCellSchedule>): boolean {
  if (a && b) {
    return a.w === b.w && iterablesAreSetEquivalent(a.ex ?? [], b.ex ?? []) && iterablesAreSetEquivalent(a.d ?? [], b.d ?? []);
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
 * A DateCellSchedule with a DateRange that signifies and end days.
 */
export interface DateCellScheduleDateRange extends DateCellSchedule, DateCellTimingDateRange {}

/**
 * A special DateCellScheduleDateRange that has both the start and end times at the start of the day in the target timezone for their given ranges.
 */
export type DateCellScheduleStartOfDayDateRange = DateCellScheduleDateRange;

/**
 * Returns true if the input is possibly a FullDateCellScheduleRange.
 *
 * Does not check that the input is a valid FullDateCellScheduleRange.
 *
 * @param input
 * @returns
 */
export function isDateCellScheduleDateRange(input: object): input is DateCellScheduleDateRange {
  if (typeof input === 'object') {
    const asRange = input as FullDateCellScheduleRange;
    return isDateCellSchedule(asRange) && isDate(asRange.end) && isDate(asRange.start);
  }

  return false;
}

/**
 * Returns true if the input is a DateCellScheduleDateRange without a duration or startsAt.
 *
 * @param input
 * @returns
 */
export function isDateCellScheduleStartOfDayDateRange(input: object): input is DateCellScheduleStartOfDayDateRange {
  if (isDateCellScheduleDateRange(input) && (input as Partial<FullDateCellScheduleRange>).duration == null && (input as Partial<FullDateCellScheduleRange>).startsAt == null) {
    const { start, end, timezone } = input;

    const normalInstance = dateTimezoneUtcNormal(timezone);
    return normalInstance.isStartOfDayInTargetTimezone(start) && normalInstance.isStartOfDayInTargetTimezone(end);
  }

  return false;
}

/**
 * Returns true if both inputs have the same schedule and date range.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameDateCellScheduleDateRange(a: Maybe<DateCellScheduleDateRange>, b: Maybe<DateCellScheduleDateRange>): boolean {
  if (a && b) {
    return isSameDateRange(a, b) && isSameDateCellSchedule(a, b);
  } else {
    return a == b;
  }
}

/**
 * Input for dateCellScheduleDateRange().
 *
 * It should be comprised of parts of a valid DateCellScheduleDateRange already. This means the start/end or startsAt/end is valid and for the given timezone.
 *
 * Invalid input has undetermined behavior.
 */
export type DateCellScheduleDateRangeInput = DateCellSchedule & Partial<TimezoneStringRef & (DateRange | DateCellTimingStartsAtEndRange)>;

/**
 * Creates a DateCellScheduleDateRange from the input.
 *
 * @param input
 * @returns
 */
export function dateCellScheduleDateRange(input: DateCellScheduleDateRangeInput): DateCellScheduleDateRange {
  const { w, ex, d, start: inputStart, startsAt: inputStartsAt, end: inputEnd, timezone: inputTimezone } = input as DateCellSchedule & Partial<FullDateCellScheduleRange>;
  const timezone: TimezoneString = inputTimezone ?? requireCurrentTimezone(); // treat input as the current timezone
  const normalInstance = dateTimezoneUtcNormal(timezone);

  let start: Date;
  let end: Date;

  // either start or startsAt is provided
  if (inputStart != null) {
    const startInSystemTimezone = normalInstance.systemDateToTargetDate(inputStart); // start needs to be in the system timezone normal before processing.
    start = normalInstance.startOfDayInTargetTimezone(startInSystemTimezone); // ensure the start of the day is set/matches the timezone.
  } else {
    if (inputStartsAt != null) {
      start = normalInstance.startOfDayInTargetTimezone(inputStartsAt);
    } else if (inputEnd != null) {
      start = normalInstance.startOfDayInTargetTimezone(inputEnd); // start on the same day as the end date
    } else {
      throw new Error('Could not determine the proper start value for the dateCellScheduleDateRange().');
    }
  }

  // set the end value
  end = inputEnd ?? addMinutes(start, 1); // default the end to one minute after the start

  return {
    w,
    ex,
    d,
    start,
    end,
    timezone
  };
}

/**
 * Changes any input DateCellScheduleDateRange to a new DateCellScheduleDateRange in the configured timezone.
 */
export type ChangeDateCellScheduleDateRangeToTimezoneFunction = ((dateRange: DateCellScheduleDateRange) => DateCellScheduleDateRange) & {
  readonly _normalInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a ChangeDateCellScheduleDateRangeToTimezoneFunction for the input timezone.
 *
 * @param timezoneInput
 * @returns
 */
export function changeDateCellScheduleDateRangeToTimezoneFunction(timezoneInput: DateCellTimingTimezoneInput): ChangeDateCellScheduleDateRangeToTimezoneFunction {
  const normalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
  const timezone = normalInstance.configuredTimezoneString as string;

  const fn = ((input: DateCellScheduleDateRange) => {
    const inputTimingNormalInstance = dateCellTimingTimezoneNormalInstance(input);

    const startNormal = inputTimingNormalInstance.baseDateToTargetDate(input.start);
    const endNormal = inputTimingNormalInstance.baseDateToTargetDate(input.end);

    const start = normalInstance.targetDateToBaseDate(startNormal);
    const end = normalInstance.targetDateToBaseDate(endNormal);

    const result: DateCellScheduleDateRange = {
      w: input.w,
      d: input.d,
      ex: input.ex,
      start,
      end,
      timezone
    };

    return result;
  }) as Building<ChangeDateCellScheduleDateRangeToTimezoneFunction>;
  fn._normalInstance = normalInstance;
  return fn as ChangeDateCellScheduleDateRangeToTimezoneFunction;
}

/**
 * Convenience function for calling changeDateCellScheduleDateRangeToTimezoneFunction() and passing the new timing and timezone.
 *
 * @param timing
 * @param timezone
 * @returns
 */
export function changeDateCellScheduleDateRangeToTimezone(timing: DateCellScheduleDateRange, timezone: DateCellTimingTimezoneInput): DateCellScheduleDateRange {
  return changeDateCellScheduleDateRangeToTimezoneFunction(timezone)(timing);
}

/**
 * A DateCellScheduleDateRange that also includes the event's startsAt time.
 */
export interface DateCellScheduleEventRange extends DateCellScheduleDateRange, DateCellTimingEventStartsAt {}

/**
 * Returns true if both inputs have the same FullDateCellScheduleRange.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameDateCellScheduleEventRange(a: Maybe<DateCellScheduleEventRange>, b: Maybe<DateCellScheduleEventRange>): boolean {
  if (a && b) {
    return isSameDateCellScheduleDateRange(a, b) && isSameDateCellScheduleEventRange(a, b);
  } else {
    return a == b;
  }
}

/**
 * A DateCellScheduleEventRange that includes the duration and implements FullDateCellTiming.
 */
export interface FullDateCellScheduleRange extends DateCellScheduleEventRange, FullDateCellTiming {}

/**
 * Returns true if the input is possibly a FullDateCellScheduleRange.
 *
 * Does not check that the input is a valid FullDateCellScheduleRange.
 *
 * @param input
 * @returns
 */
export function isFullDateCellScheduleDateRange(input: object): input is FullDateCellScheduleRange {
  if (typeof input === 'object') {
    const asRange = input as FullDateCellScheduleRange;
    return isDateCellSchedule(asRange) && isFullDateCellTiming(asRange);
  }

  return false;
}

/**
 * Returns true if both inputs have the same FullDateCellScheduleRange.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameFullDateCellScheduleDateRange(a: Maybe<FullDateCellScheduleRange>, b: Maybe<FullDateCellScheduleRange>): boolean {
  if (a && b) {
    return isSameDateCellScheduleDateRange(a, b) && isSameFullDateCellTiming(a, b);
  } else {
    return a == b;
  }
}

/**
 * Different types of inputs for fullDateCellScheduleRange() that can be used to derive a FullDateCellScheduleRange.
 */
export type FullDateCellScheduleRangeInputDateRange = DateCellScheduleDateRange | DateCellScheduleEventRange | FullDateCellScheduleRange | DateCellScheduleDateRangeInput;

export interface FullDateCellScheduleRangeInput {
  /**
   * Input schedule range to expand from.
   */
  readonly dateCellScheduleRange: FullDateCellScheduleRangeInputDateRange;
  /**
   * (Optional) Duration of the timing to use.
   *
   * If a duration is provided in the timing, this is ignored unless updateWithDefaults is true.
   */
  readonly duration?: number;
  /**
   * (Optional) Hours/Minutes to copy from when setting the inital startsAt.
   *
   * This will not change the timing's start/end date range, but it will update the end date.
   *
   * If a startsAt is provided in the timing, this is ignored unless updateWithDefaults is true.
   */
  readonly startsAtTime?: Date;
  /**
   * Whether or not to always update the range with the default duration/startsAt time
   */
  readonly updateWithDefaults?: boolean;
}

/**
 * If a duration is not set, this is the default used.
 */
export const DEFAULT_FULL_DATE_SCHEDULE_RANGE_DURATION = 1;

/**
 * Creates a FullDateCellScheduleRange from the input.
 */
export function fullDateCellScheduleRange(input: FullDateCellScheduleRangeInput): FullDateCellScheduleRange {
  const { dateCellScheduleRange, duration: inputDefaultDuration, startsAtTime: inputDefaultStartsAtTime, updateWithDefaults } = input;
  let initialFullDateRange: FullDateCellScheduleRange;

  const inputStartsAt = (dateCellScheduleRange as Partial<FullDateCellScheduleRange>).startsAt;
  const inputDuration = (dateCellScheduleRange as Partial<FullDateCellScheduleRange>).duration;

  const needsDurationAdjustment = inputStartsAt == null || (updateWithDefaults && inputDefaultDuration != null);
  const needsStartsAtAdjustment = inputDuration == null || (updateWithDefaults && inputDefaultStartsAtTime != null);

  if (isFullDateCellScheduleDateRange(dateCellScheduleRange)) {
    initialFullDateRange = dateCellScheduleRange; // no need to create a FullDateCellScheduleRange
  } else {
    // fill in the blanks for the date range
    const initialDateRange = dateCellScheduleDateRange(dateCellScheduleRange) as FullDateCellScheduleRange;
    initialDateRange.startsAt = inputStartsAt ?? initialDateRange.start;
    initialDateRange.duration = inputDuration ?? DEFAULT_FULL_DATE_SCHEDULE_RANGE_DURATION; // copy duration and startsAt
    initialFullDateRange = initialDateRange;

    if (isDateCellScheduleStartOfDayDateRange(dateCellScheduleRange)) {
      const startOfLastDay = initialFullDateRange.end;
      const startsAtOnLastDay = dateCellTimingStartsAtDateFactory(initialFullDateRange)(startOfLastDay);
      initialFullDateRange.end = addMinutes(startsAtOnLastDay, initialDateRange.duration);
    }
  }

  let fullDateCellTiming: FullDateCellTiming = initialFullDateRange;

  // Apply adjustments as needed
  if (needsDurationAdjustment || needsStartsAtAdjustment) {
    fullDateCellTiming = updateDateCellTimingWithDateCellTimingEvent({
      timing: initialFullDateRange,
      event: {
        startsAt: inputDefaultStartsAtTime ?? initialFullDateRange.startsAt,
        duration: inputDefaultDuration ?? initialFullDateRange.duration
      },
      // flag to replace the necessary items
      replaceStartsAt: needsStartsAtAdjustment,
      replaceDuration: needsDurationAdjustment
    });
  }

  const result: FullDateCellScheduleRange = {
    timezone: fullDateCellTiming.timezone,
    start: fullDateCellTiming.start,
    startsAt: fullDateCellTiming.startsAt,
    end: fullDateCellTiming.end,
    duration: fullDateCellTiming.duration,
    w: initialFullDateRange.w,
    ex: initialFullDateRange.ex,
    d: initialFullDateRange.d
  };

  return result;
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
export interface DateCellScheduleDateFilterConfig extends DateCellSchedule, Partial<DateCellTimingStartsAtEndRange & DateCellTimingDateRange> {
  /**
   * The min/max date range for the filter.
   */
  minMaxDateRange?: Maybe<Partial<DateCellRangeOrDateRange>>;
  /**
   * Whether or not to restrict the start as the min date if a min date is not set in minMaxDateRange. True by default.
   */
  setStartAsMinDate?: boolean;
}

export function copyDateCellScheduleDateFilterConfig(inputFilter: DateCellScheduleDateFilterConfig): DateCellScheduleDateFilterConfig {
  return {
    start: inputFilter.start,
    startsAt: inputFilter.startsAt,
    end: inputFilter.end,
    timezone: inputFilter.timezone,
    w: inputFilter.w,
    d: inputFilter.d,
    ex: inputFilter.ex,
    // filter extras
    minMaxDateRange: inputFilter.minMaxDateRange,
    setStartAsMinDate: inputFilter.setStartAsMinDate
  };
}

/**
 * Creates a DateCellScheduleDateFilter.
 *
 * @param config
 * @returns
 */
export function dateCellScheduleDateFilter(config: DateCellScheduleDateFilterConfig): DateCellScheduleDateFilter {
  const { w, start: inputStart, startsAt: inputStartsAt, end: inputEnd, timezone: inputTimezone, setStartAsMinDate = true, minMaxDateRange } = config;

  const timezone = inputTimezone ?? requireCurrentTimezone(); // if the timezone is not provided, assume the startsAt is a system timezone normal.
  const normalInstance = dateTimezoneUtcNormal(timezone);

  // derive the startsAt time for the range. If not provided, defaults to inputStart, or midnight today in the target timezone.
  const startsAt: Date = inputStartsAt != null ? inputStartsAt : inputStart ?? normalInstance.startOfDayInTargetTimezone();
  const allowedDays: Set<DayOfWeek> = expandDateCellScheduleDayCodesToDayOfWeekSet(w);

  const startsAtInSystem: Date = normalInstance.systemDateToTargetDate(startsAt); // convert to the system date
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
  const maxAllowedIndex = end != null ? dateIndexForDate(end) : minMaxDateRange?.end != null ? dateIndexForDate(minMaxDateRange.end) : Number.MAX_SAFE_INTEGER; // max "to" value

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
  /**
   * Index range to limit the expansion to.
   */
  readonly limitIndexRange?: IndexRange;
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
  const { timing, limitIndexRange } = input;
  const expansionFactory = expandDateCellScheduleFactory(input);
  const completeRange = dateCellIndexRange(timing);
  const range = limitIndexRange ? { minIndex: Math.max(limitIndexRange.minIndex, completeRange.minIndex), maxIndex: Math.min(limitIndexRange.maxIndex, completeRange.maxIndex) } : completeRange;
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
  readonly dateCellScheduleRange: FullDateCellScheduleRangeInputDateRange;
  /**
   * (Optional) Duration of the timing to replace the dateCellScheduleRange's duration.
   */
  readonly duration?: number;
  /**
   * (Optional) Hours/Minutes to replace the dateCellScheduleRange's startsAt time.
   *
   * Note, this will modify the timing's end date to be a valid time.
   */
  readonly startsAtTime?: Date;
}

/**
 *
 * @param input
 * @returns
 */
export function expandDateCellScheduleRange(input: ExpandDateCellScheduleRangeInput): DateCellDurationSpan<DateCell>[] {
  const { dateCellScheduleRange, duration, startsAtTime } = input;
  const fullDateRange = fullDateCellScheduleRange({
    dateCellScheduleRange,
    duration,
    startsAtTime,
    updateWithDefaults: true
  });

  return expandDateCellSchedule({ ...input, schedule: fullDateRange, timing: fullDateRange });
}

// MARK: DateCellScheduleRange
export type ExpandDateCellScheduleRangeToDateCellRangeInput = ExpandDateCellScheduleRangeInput;

export function expandDateCellScheduleRangeToDateCellRanges(input: ExpandDateCellScheduleRangeToDateCellRangeInput): DateCellRangeWithRange[] {
  const dateCellDurationSpans = expandDateCellScheduleRange(input);
  return groupToDateCellRanges(dateCellDurationSpans);
}
