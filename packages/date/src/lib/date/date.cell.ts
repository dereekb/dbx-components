import {
  DayOfWeek,
  RequiredOnKeys,
  IndexNumber,
  IndexRange,
  indexRangeCheckFunction,
  IndexRef,
  MINUTES_IN_DAY,
  MS_IN_DAY,
  UniqueModel,
  lastValue,
  FactoryWithRequiredInput,
  FilterFunction,
  mergeFilterFunctions,
  range,
  Milliseconds,
  Hours,
  MapFunction,
  getNextDay,
  SortCompareFunction,
  sortAscendingIndexNumberRefFunction,
  mergeArrayIntoArray,
  Configurable,
  ArrayOrValue,
  asArray,
  sumOfIntegersBetween,
  filterMaybeValues,
  Maybe,
  TimezoneString,
  Building,
  addToSet,
  ISO8601DayString,
  Minutes,
  MS_IN_HOUR,
  minutesToFractionalHours,
  FractionalHour,
  HOURS_IN_DAY,
  DateRelativeState,
  groupValues,
  makeValuesGroupMap,
  findBestIndexMatchFunction,
  TimezoneStringRef,
  MS_IN_MINUTE,
  fractionalHoursToMinutes
} from '@dereekb/util';
import { dateRange, DateRange, DateRangeDayDistanceInput, DateRangeStart, DateRangeType, isDateRange, isDateRangeStart } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addDays, addMinutes, getSeconds, getMilliseconds, getMinutes, addMilliseconds, hoursToMilliseconds, addHours, differenceInHours, isAfter, minutesToHours, differenceInMinutes, startOfDay, milliseconds } from 'date-fns';
import { isDate, copyHoursAndMinutesFromDate, roundDownToMinute, copyHoursAndMinutesFromNow, isSameDate } from './date';
import { Expose, Type } from 'class-transformer';
import { DateTimezoneUtcNormalFunctionInput, DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, getCurrentSystemOffsetInHours, startOfDayInTimezoneDayStringFactory, copyHoursAndMinutesFromDateWithTimezoneNormal, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE, copyHoursAndMinutesFromNowWithTimezoneNormal, DateTimezoneConversionConfigUseSystemTimezone, systemDateTimezoneUtcNormal } from './date.timezone';
import { IsDate, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { parseISO8601DayStringToDate, parseISO8601DayStringToUTCDate } from './date.format';
import { IsKnownTimezone } from '../timezone/timezone.validator';
import { fitDateRangeToDayPeriod } from './date.range.timezone';
import { assertedTimingDateTimezoneUtcNormal, DateBlockTimingEvent, timingDateTimezoneUtcNormal, TimingDateTimezoneUtcNormalInput } from './date.block';

/**
 * Index from 0 of which day this block represents.
 */
export type DateCellIndex = number;

/**
 * Returns true if the index is a non-negative integer.
 *
 * @param input
 */
export function isValidDateCellIndex(input: DateCellIndex): boolean {
  return input >= 0 && Number.isInteger(input);
}

/**
 * Input type that is either a Date or a DateCellIndex.
 */
export type DateOrDateCellIndex = Date | DateCellIndex;

/**
 * A duration-span block.
 */
export interface DateCell extends IndexRef {
  i: DateCellIndex;
}

export class DateCell {
  @Expose()
  @IsNumber()
  @Min(0)
  i!: DateCellIndex;

  constructor(template?: DateCell) {
    if (template) {
      this.i = template.i;
    }
  }
}

/**
 * Converts the input number or DateCell to a DateCell.
 *
 * @param dateCellOrIndex
 * @returns
 */
export function dateCell(dateCellOrIndex: DateCellIndex | DateCell): DateCell {
  return typeof dateCellOrIndex === 'number' ? { i: dateCellOrIndex } : dateCellOrIndex;
}

/**
 * An array of DateCell-like values.
 */
export type DateCellArray<B extends DateCell = DateCell> = B[];

/**
 * Reference to a DateCellArray
 */
export type DateCellArrayRef<B extends DateCell = DateCell> = {
  blocks: DateCellArray<B>;
};

/**
 * The DateCellTimingStartsAt and startsAt times and timezone.
 *
 * Used to derive the indexes for the days.
 */
export type DateCellTimingStartsAt = Pick<DateCellTiming, 'startsAt' | 'timezone'>;

/**
 * The DateCellTimingEnd and endsAt times and timezone.
 */
export type DateCellTimingEnd = Pick<DateCellTiming, 'end'>;

/**
 * Is combination of DateRange and DateDurationSpan. The DateRange captures a range of days that a DateCell takes up, and the DateDurationSpan
 * captures the Dates at which the Job occurs at.
 *
 * NOTES:
 * - The startsAt time is the time of the first event.
 * - The end time is the ending date/time of the final end duration.
 * - The timezone is required to properly handle daylight savings and timezone differences.
 */
export interface DateCellTiming extends DateDurationSpan, TimezoneStringRef, Pick<DateRange, 'end'> {}

export class DateCellTiming extends DateDurationSpan {
  @Expose()
  @IsDate()
  @Type(() => Date)
  end!: Date;

  @Expose()
  @IsString()
  @IsKnownTimezone()
  timezone!: TimezoneString;

  constructor(template?: DateCellTiming) {
    super(template);

    if (template) {
      this.end = template.end;
      this.timezone = template.timezone;
    }
  }
}

/**
 * Reference to a DateCellTiming
 */
export interface DateCellTimingRef {
  timing: DateCellTiming;
}

/**
 * An object that implements DateCellTimingRef and DateCellArrayRef
 */
export interface DateCellCollection<B extends DateCell = DateCell> extends DateCellTimingRef, DateCellArrayRef<B> {}

/**
 * An expanded DateCell that implements DateDurationSpan and contains the DateCell values.
 */
export type DateCellDurationSpan<B extends DateCell = DateCell> = DateDurationSpan & B;

/**
 * The DateRange input for dateCellTiming()
 */
export type DateCellTimingRangeInput = Pick<DateRangeDayDistanceInput, 'distance'> | DateRange | number;

/**
 * Can use any timezone instance that has a timezone configured, or is using the
 */
export type DateCellTimingTimezoneInput = Omit<DateTimezoneUtcNormalFunctionInput, 'number'>;

/**
 * Creates a DateTimezoneUtcNormalInstance from the input. Asserts and gurantees that a timezone string is provided.
 *
 * If null/undefined is passed, returns a normal for the system time.
 *
 * @param timezoneInput
 * @returns
 */
export function dateCellTimingTimezoneNormalInstance(timezoneInput?: DateCellTimingTimezoneInput): DateTimezoneUtcNormalInstance {
  const normalInstance = timezoneInput ? dateTimezoneUtcNormal(timezoneInput) : systemDateTimezoneUtcNormal();
  const timezone = normalInstance.configuredTimezoneString;

  if (!timezone) {
    throw new Error('dateCellTiming() timezone must be defined and be a known timezone string.');
  }

  return normalInstance;
}

/**
 * A DateCellTiming with the start date also provided.
 */
export interface FullDateCellTiming extends DateCellTiming, DateRange {}

/**
 * The start date within a FullDateCellTiming.
 */
export type FullDateCellTimingStart = Pick<FullDateCellTiming, 'start'>;

/**
 * Creates a FullDateCellTiming from the input timing.
 *
 * @param timing
 * @returns
 */
export function fullDateCellTiming(timing: DateCellTiming): FullDateCellTiming {
  return fullDateCellTimingTimezonePair(timing).fullTiming;
}

export interface FullDateCellTimingTimezonePair {
  readonly fullTiming: FullDateCellTiming;
  readonly normalInstance: DateTimezoneUtcNormalInstance;
}

/**
 * Creates a FullDateCellTimingTimezonePair from the input timing.
 *
 * @param timing
 * @returns
 */
export function fullDateCellTimingTimezonePair(timing: DateCellTiming): FullDateCellTimingTimezonePair {
  const { startsAt, end, duration, timezone } = timing;
  const { start, normalInstance } = dateCellTimingStartPair(timing);

  const fullTiming = {
    start,
    startsAt,
    end,
    duration,
    timezone
  };

  return {
    fullTiming,
    normalInstance
  };
}

/**
 * Returns true if the start date has no minutes/seconds/milliseconds. It should be midnight for it's target timezone.
 *
 * @param date
 * @returns
 */
export function isValidDateCellTimingStartDate(date: Date): boolean {
  return getMinutes(date) === 0 && getSeconds(date) === 0 && getMilliseconds(date) === 0;
}

/**
 * Creates a valid DateCell timing from the DateDurationSpan and range input.
 *
 * The duration is first considered, then the date range is applied to it.
 *
 * If a number is passed as the input range, then the duration's startsAt date will be used and the input number used as the distance.
 * The input range's date takes priority over the duration's startsAt start date, meaning the input date range will be adapted
 * to fit the startsAt time.
 *
 * The input range date is used as the start and end date ranges, meaning they will be used as the expected date offset (have only hours, no minutes/seconds/milliseconds) and be validated as such.
 * The end date is used just to determine the number of days, but a minimum of 1 day is always enforced as a DateCellTiming must contain atleast 1 day.
 *
 * The start date from the inputDate is considered to to have the offset noted in DateCell, and will be retained.
 */
export function dateCellTiming(durationInput: DateDurationSpan, inputRange: DateCellTimingRangeInput, timezoneInput?: DateCellTimingTimezoneInput): FullDateCellTiming {
  const { duration } = durationInput;

  if (duration > MINUTES_IN_DAY) {
    throw new Error('dateCellTiming() duration cannot be longer than 24 hours.');
  }

  const normalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
  const timezone = normalInstance.configuredTimezoneString as string;

  let { startsAt: inputStartsAt } = durationInput;

  // it is important that startsAt is evaluated the system time normal, as addDays/addMinutes and related functionality rely on the system timezone.
  let startsAtInSystemTimezone = normalInstance ? normalInstance.systemDateToTargetDate(inputStartsAt) : inputStartsAt;

  let numberOfBlockedDays: number;

  let inputDate: Date | undefined;
  let range: DateRange;

  if (typeof inputRange === 'number') {
    // input range is a number of days
    numberOfBlockedDays = inputRange - 1;
    range = dateRange({ type: DateRangeType.DAY, date: startsAtInSystemTimezone });
  } else if (isDateRange(inputRange)) {
    // input range is a DateRange
    range = inputRange;
    inputDate = inputRange.start;

    if (!isValidDateCellTimingStartDate(inputRange.start)) {
      throw new Error('Invalid dateCellTiming start date passed to dateCellTiming() via inputRange.');
    }

    numberOfBlockedDays = differenceInDays(inputRange.end, inputRange.start); // min of 1 day
  } else {
    // input range is a Date
    inputDate = startsAtInSystemTimezone;
    numberOfBlockedDays = inputRange.distance - 1;
    range = dateRange({ type: DateRangeType.DAY, date: inputDate }, true);
  }

  if (inputDate != null) {
    // input date takes priority, so move the startsAt's date to be on the same date.
    startsAtInSystemTimezone = copyHoursAndMinutesFromDate(range.start, startsAtInSystemTimezone, true);

    const startedBeforeRange = isBefore(startsAtInSystemTimezone, range.start);

    if (startedBeforeRange) {
      startsAtInSystemTimezone = addDays(startsAtInSystemTimezone, 1); // starts 24 hours later
      numberOfBlockedDays = Math.max(numberOfBlockedDays - 1, 0); // reduce number of applied days by 1, to a min of 0
    }
  } else {
    startsAtInSystemTimezone = roundDownToMinute(startsAtInSystemTimezone); // clear seconds and milliseconds from startsAt
  }

  const lastStartsAtInSystemTimezone = addDays(startsAtInSystemTimezone, numberOfBlockedDays); // use addDays so the system (if it experiences daylight savings) can change for daylight savings

  // calculate end to be the ending date/time of the final duration span
  const end: Date = normalInstance.targetDateToSystemDate(addMinutes(lastStartsAtInSystemTimezone, duration));

  const start = normalInstance.targetDateToSystemDate(startOfDay(startsAtInSystemTimezone));
  const startsAt = normalInstance.targetDateToSystemDate(startsAtInSystemTimezone);

  return {
    start,
    end,
    startsAt,
    duration,
    timezone
  };
}

export interface DateCellTimingStartPair {
  readonly start: Date;
  readonly normalInstance: DateTimezoneUtcNormalInstance;
}

/**
 * Convenience function of dateCellTimingStart() that also returns the DateTimezoneUtcNormalInstance.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingStartPair(timing: DateCellTimingStartsAt): DateCellTimingStartPair {
  const { startsAt, timezone } = timing;
  const normalInstance = dateTimezoneUtcNormal(timezone);
  const startsAtInSystem = normalInstance.systemDateToTargetDate(startsAt);
  const start = normalInstance.startOfDayInTargetTimezone(startsAtInSystem);

  return {
    start,
    normalInstance
  };
}

/**
 * Start date value for a DateCellTiming.
 *
 * This is the midnight date instance for the timezone.
 */
export function dateCellTimingStart(timing: DateCellTimingStartsAt): Date {
  return dateCellTimingStartPair(timing).start;
}

/**
 * The DateRange component and timezone for a DateCellTiming. The start date is a DateCellTimingStartsAt.
 */
export type DateCellTimingStartsAtEndRange = Pick<DateCellTiming, 'startsAt' | 'end' | 'timezone'>;

/**
 * The startsAt time of the event.
 */
export type DateCellTimingEventStartsAt = Pick<DateCellTiming, 'startsAt'>;

/**
 * A startsAt time and duration that represents a single event.
 */
export type DateCellTimingEvent = Pick<DateCellTiming, 'startsAt' | 'duration'>;

/**
 * Returns true if the two timings are equivalent.
 *
 * @param a
 * @param b
 */
export function isSameDateCellTiming(a: Maybe<DateCellTiming>, b: Maybe<DateCellTiming>): boolean {
  return a && b ? a.duration === b.duration && a.timezone === b.timezone && isSameDate(a.startsAt, b.startsAt) : a == b;
}

/**
 * Returns the date range from the start of the first day in that timezone to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingFullRange(timing: DateCellTimingStartsAtEndRange): DateRange {
  const start = dateCellTimingStart(timing);
  return { start, end: timing.end };
}

/**
 * Returns the date range from the start of the first event to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingEventRange(timing: Pick<DateCellTiming, 'startsAt' | 'end'>): DateRange {
  return { start: timing.startsAt, end: timing.end };
}

/**
 * Returns the total minutes between the start of the first event and the end of the last event.
 *
 * @param timing
 * @returns
 */
export function getDateCellTimingFirstEventDateRange(timing: DateCellTimingStartsAtEndRange): DateRange {
  return fitDateRangeToDayPeriod({ start: timing.startsAt, end: timing.end }, timing.timezone);
}

/**
 * Returns the number of hours in a DateCellTiming's duration.
 *
 * @param timing
 */
export function getDateCellTimingHoursInEvent(timing: Pick<DateCellTiming, 'duration'>): FractionalHour {
  return minutesToFractionalHours(timing.duration);
}

/**
 * Returns a copy of the input timing with the start time timezone in the given timezone.
 *
 * The start time is a normal, and should still refer to the same UTC date, but with the given timing's offset.
 *
 * @param timing
 */
export type ChangeDateCellTimingToTimezoneFunction = (<T extends DateRangeStart>(timing: T) => T) & {
  readonly _normalInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a ChangeDateCellTimingToTimezoneFunction from the input.
 *
 * @param input
 * @returns
 */
export function changeDateCellTimingToTimezoneFunction(timezoneInput: DateCellTimingTimezoneInput): ChangeDateCellTimingToTimezoneFunction {
  const normalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
  const timezone = normalInstance.configuredTimezoneString as string;

  const fn = (<T extends DateCellTiming>(timing: T) => {
    const timingNormalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
    const startsAtNormal = timingNormalInstance.baseDateToTargetDate(timing.startsAt);
    const endNormal = timingNormalInstance.baseDateToTargetDate(timing.end);

    const startsAt = normalInstance.targetDateToBaseDate(startsAtNormal);
    const end = normalInstance.targetDateToBaseDate(endNormal);

    const newTiming = {
      ...timing,
      timezone,
      startsAt,
      end
    };

    return newTiming;
  }) as Building<ChangeDateCellTimingToTimezoneFunction>;
  fn._normalInstance = normalInstance;
  return fn as ChangeDateCellTimingToTimezoneFunction;
}

export function changeDateCellTimingToTimezone<T extends DateRangeStart>(timing: T, timezone: DateCellTimingTimezoneInput): T {
  return changeDateCellTimingToTimezoneFunction(timezone)(timing);
}

export function changeDateCellTimingToSystemTimezone<T extends DateRangeStart>(timing: T): T {
  return changeDateCellTimingToTimezoneFunction(SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE)(timing);
}

export interface CalculateExpectedDateCellTimingDurationPair {
  readonly duration: Minutes;
  readonly expectedFinalStartsAt: Date;
}

/**
 * Returns the expected duration from the input.
 *
 * @param timing
 * @returns
 */
export function calculateExpectedDateCellTimingDurationPair(timing: DateCellTimingStartsAtEndRange): CalculateExpectedDateCellTimingDurationPair {
  const { end, startsAt, timezone } = timing;
  const normalInstance = dateTimezoneUtcNormal(timezone);

  const startsAtInUtcNormal = normalInstance.baseDateToTargetDate(startsAt); // convert to UTC normal
  const endInUtcNormal = normalInstance.baseDateToTargetDate(end);

  const finalMsDifferenceBetweenStartAndEnd = differenceInMilliseconds(endInUtcNormal, startsAtInUtcNormal);
  const duration = (finalMsDifferenceBetweenStartAndEnd / MS_IN_MINUTE) % MINUTES_IN_DAY || MINUTES_IN_DAY;
  const expectedFinalStartsAt = normalInstance.targetDateToBaseDate(addMinutes(endInUtcNormal, -duration));

  // console.log({ finalMsDifferenceBetweenStartAndEnd, duration, expectedFinalStartsAt, startsAt, end, endInUtc: endInUtcNormal, startsAtInUtc: startsAtInUtcNormal });

  return {
    duration,
    expectedFinalStartsAt
  };
}

export function calculateExpectedDateCellTimingDuration(timing: DateCellTimingStartsAtEndRange): Minutes {
  return calculateExpectedDateCellTimingDurationPair(timing).duration;
}

/**
 * Returns the final StartsAt time.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingFinalStartsAtEvent(timing: DateCellTimingStartsAtEndRange): DateBlockTimingEvent {
  const { duration, expectedFinalStartsAt: startsAt } = calculateExpectedDateCellTimingDurationPair(timing);
  return {
    startsAt,
    duration
  };
}

export interface IsValidDateCellTimingInfo {
  readonly isValid: boolean;
  readonly startsAtHasZeroSeconds: boolean;
  readonly endIsAfterTheStartsAtTime: boolean;
  readonly durationGreaterThanZero: boolean;
  readonly durationLessThan24Hours: boolean;
  readonly isExpectedValidEnd: boolean;
  readonly normalInstance: DateTimezoneUtcNormalInstance;
}

export function isValidDateCellTimingInfo(timing: DateCellTiming): IsValidDateCellTimingInfo {
  const { end, startsAt, duration, timezone } = timing;
  const normalInstance = dateTimezoneUtcNormal(timezone);

  const endIsAfterTheStartsAtTime = isAfter(end, startsAt);
  const durationGreaterThanZero = duration > 0;
  const durationLessThan24Hours = duration <= MINUTES_IN_DAY;
  const startsAtHasZeroSeconds = startsAt.getSeconds() === 0 && startsAt.getMilliseconds() === 0;

  let isValid: boolean = false;
  let isExpectedValidEnd: boolean = false;

  if (
    endIsAfterTheStartsAtTime && // end must be after the startsAt time
    durationGreaterThanZero &&
    durationLessThan24Hours &&
    startsAtHasZeroSeconds
  ) {
    const expectedDuration = calculateExpectedDateCellTimingDuration(timing);
    isExpectedValidEnd = expectedDuration === duration; // should be the expected duration
    isValid = isExpectedValidEnd;
  }

  const result = {
    isValid,
    endIsAfterTheStartsAtTime,
    durationGreaterThanZero,
    durationLessThan24Hours,
    startsAtHasZeroSeconds,
    isExpectedValidEnd,
    normalInstance
  };

  return result;
}

/**
 * Convenience function for checking whether or not DateCellTiming is valid.
 *
 * @param timing
 * @returns
 */
export function isValidDateCellTiming(timing: DateCellTiming): boolean {
  const { isValid } = isValidDateCellTimingInfo(timing);
  return isValid;
}

export interface IsValidFullDateCellTimingInfo extends IsValidDateCellTimingInfo {
  readonly isStartRoundedToSeconds: boolean;
  readonly startIsAtMidnight: boolean;
  readonly startHasZeroSeconds: boolean;
  readonly startsAtIsAfterStart: boolean;
  readonly startsAtIsLessThan24HoursAfterStart: boolean;
}

export function isValidFullDateCellTimingInfo(timing: FullDateCellTiming): IsValidFullDateCellTimingInfo {
  const { start, normalInstance } = dateCellTimingStartPair(timing);
  const { startsAt } = timing;

  const isValidInfo = isValidDateCellTimingInfo(timing);
  const { endIsAfterTheStartsAtTime, durationGreaterThanZero, durationLessThan24Hours, startsAtHasZeroSeconds, isExpectedValidEnd } = isValidInfo;

  const isStartRoundedToSeconds = start.getMilliseconds() === 0; // should have no milliseconds specified
  const msDifference = differenceInMilliseconds(startsAt, start); // startsAt is a specific instance to compare to the midnight instant of the target timezone

  const startHasZeroSeconds = start.getSeconds() === 0;
  const startsAtIsAfterStart = msDifference >= 0;
  const startsAtIsLessThan24HoursAfterStart = msDifference < MS_IN_DAY;

  const startInUtc = normalInstance.baseDateToTargetDate(start);
  const startIsAtMidnight = startInUtc.getUTCHours() === 0 && startInUtc.getMinutes() === 0;

  const isValid: boolean =
    isValidInfo.isValid &&
    isStartRoundedToSeconds &&
    endIsAfterTheStartsAtTime && // end must be after the startsAt time
    durationGreaterThanZero &&
    durationLessThan24Hours &&
    startHasZeroSeconds && // start cannot have seconds
    startsAtIsAfterStart && // startsAt is after start instance, secondsDifference
    startsAtIsLessThan24HoursAfterStart && // startsAt is not 24 hours or more later. If so, should start at that time instead.
    startIsAtMidnight;

  const result: IsValidFullDateCellTimingInfo = {
    isValid,
    isStartRoundedToSeconds,
    startIsAtMidnight,
    startHasZeroSeconds,
    startsAtIsAfterStart,
    startsAtIsLessThan24HoursAfterStart,
    endIsAfterTheStartsAtTime,
    durationGreaterThanZero,
    durationLessThan24Hours,
    startsAtHasZeroSeconds,
    isExpectedValidEnd,
    normalInstance
  };

  // console.log({ timing, result, msDifference, startsAt, start });

  return result;
}

export function isValidFullDateCellTiming(timing: FullDateCellTiming): boolean {
  const { isValid } = isValidFullDateCellTimingInfo(timing);
  return isValid;
}
