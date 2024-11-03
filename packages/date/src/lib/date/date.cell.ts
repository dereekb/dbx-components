import { type IndexRef, MINUTES_IN_DAY, MS_IN_DAY, type Maybe, type TimezoneString, type Building, type Minutes, minutesToFractionalHours, type FractionalHour, type TimezoneStringRef, MS_IN_MINUTE, type ISO8601DayString, UTC_TIMEZONE_STRING, startOfDayForUTCDateInUTC, isEqualDate, MS_IN_HOUR } from '@dereekb/util';
import { type DateRange, type DateRangeDayDistanceInput, isDateRange } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addMinutes, getSeconds, getMilliseconds, getMinutes, isAfter, startOfDay, addHours, differenceInHours, isSameDay, differenceInMinutes } from 'date-fns';
import { roundDownToMinute, isSameDate, isDate, requireCurrentTimezone, copyHoursAndMinutesFromUTCDate } from './date';
import { Expose, Type } from 'class-transformer';
import { type DateTimezoneUtcNormalFunctionInput, type DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE, systemDateTimezoneUtcNormal, UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';
import { IsDate, IsNumber, IsString, Min } from 'class-validator';
import { IsKnownTimezone } from '../timezone/timezone.validator';
import { fitDateRangeToDayPeriod } from './date.range.timezone';
import { formatToISO8601DayStringForUTC } from './date.format';

/**
 * Index from 0 of which day this block represents.
 *
 * It is easiest to think of DateCellIndexes as days on a calendar. An index of 0 means the entire first day for that timezone.
 *
 * It is not the time from the startsAt time to the endsAt time for a period.
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
 * A date and the relative date index.
 */
export interface DateCellIndexDatePair extends Readonly<IndexRef> {
  readonly date: Date;
}

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
 * Input for dateCellTimingStartsAtForStartOfDay()
 */
export interface DateCellTimingStartsAtForStartOfDayInput {
  /**
   * "Now" date in the system timezone normal.
   */
  readonly now?: Date | ISO8601DayString;
  /**
   * Timezone string
   */
  readonly timezone?: TimezoneString;
}

/**
 * Creates a new DateCellTimingStartsAt for the given time and timezone.
 *
 * @param now
 * @returns
 */
export function dateCellTimingStartsAtForStartOfDay(input: DateCellTimingStartsAtForStartOfDayInput = {}): DateCellTimingStartsAt {
  const timezone = input.timezone ?? requireCurrentTimezone();
  let startsAt = startOfDay(new Date());

  if (input.timezone != null) {
    startsAt = dateTimezoneUtcNormal(timezone).targetDateToSystemDate(startsAt);
  }

  return {
    startsAt,
    timezone
  };
}

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

/**
 * Corresponds to the range of dates in a DateCellTiming.
 *
 * NOTES:
 * - The start time is midnight in the given timezone of the first day of the range.
 * - The end time is the ending date/time of the final end duration.
 * - The timezone is required to properly handle daylight savings and timezone differences.
 */
export interface DateCellTimingDateRange extends DateRange, TimezoneStringRef {}

/**
 * A DateCellTimingDateRange, but the start time is the startsAt time for the first event.
 */
export type DateCellTimingEventRange = DateCellTimingDateRange;

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
export type DateCellTimingRangeInput = DateRangeDayDistanceInput | DateRange | number;

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
 * A DateCellTiming that also implements DateCellTimingDateRange.
 */
export interface FullDateCellTiming extends DateCellTiming, DateCellTimingDateRange {}

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
export function dateCellTiming(durationInput: DateDurationSpan, rangeInput: DateCellTimingRangeInput, timezoneInput?: DateCellTimingTimezoneInput): FullDateCellTiming {
  const { duration } = durationInput;

  if (duration > MINUTES_IN_DAY) {
    throw new Error('dateCellTiming() duration cannot be longer than 24 hours.');
  }

  const normalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
  const timezone = normalInstance.configuredTimezoneString as string;

  const { startsAt: inputStartsAt } = durationInput;

  // it is important that startsAt is evaluated the base time normal so we can avoid daylight savings issues
  const startsAtInUtcInitial = normalInstance.baseDateToTargetDate(inputStartsAt);
  let startsAtInUtc = startsAtInUtcInitial;

  let numberOfDayBlocks: number;

  let hasRangeFromInput = false;
  let rangeInUtc: DateRange;

  function createRangeWithStart(dateInUtc: Date) {
    const startOfDateInUtc = startOfDayForUTCDateInUTC(dateInUtc);

    return {
      start: startOfDateInUtc,
      end: addMinutes(addHours(startOfDateInUtc, 24), -1)
    };
  }

  if (typeof rangeInput === 'number') {
    // input range is a number of days
    numberOfDayBlocks = rangeInput - 1;
    rangeInUtc = createRangeWithStart(startsAtInUtc);
  } else if (!isDateRange(rangeInput)) {
    // inputRange is a distance
    numberOfDayBlocks = rangeInput.distance - 1;

    const startDateInUtc = rangeInput.date ? normalInstance.baseDateToSystemDate(rangeInput.date) : startsAtInUtc;
    rangeInUtc = createRangeWithStart(startDateInUtc);
    hasRangeFromInput = true;
  } else {
    // input range is a DateRange
    if (!isValidDateCellTimingStartDate(rangeInput.start)) {
      throw new Error('Invalid dateCellTiming start date passed to dateCellTiming() via inputRange.');
    }

    rangeInUtc = normalInstance.transformDateRangeToTimezoneFunction('baseDateToSystemDate')(rangeInput);
    numberOfDayBlocks = differenceInDays(rangeInput.end, rangeInput.start); // min of 1 day. Uses system time as-is
    hasRangeFromInput = true;
  }

  if (hasRangeFromInput) {
    // input date takes priority, so move the startsAt's date to be on the same date.
    startsAtInUtc = copyHoursAndMinutesFromUTCDate(rangeInUtc.start, startsAtInUtc, true);
    const startedBeforeRange = isBefore(startsAtInUtc, rangeInUtc.start);

    if (startedBeforeRange) {
      startsAtInUtc = addHours(startsAtInUtc, 24); // starts 24 hours later
      numberOfDayBlocks = Math.max(numberOfDayBlocks - 1, 0); // reduce number of applied days by 1, to a min of 0
    }
  } else {
    startsAtInUtc = roundDownToMinute(startsAtInUtc); // clear seconds and milliseconds from startsAt
  }

  const utcDay = formatToISO8601DayStringForUTC(startsAtInUtc);
  const start = normalInstance.startOfDayInTargetTimezone(utcDay);

  const safeMirror = isEqualDate(startsAtInUtc, startsAtInUtcInitial);
  let { date: startsAt, daylightSavingsOffset } = normalInstance.safeMirroredConvertDate(startsAtInUtc, inputStartsAt, 'target', safeMirror);

  /*
  let startsAt = normalInstance.targetDateToBaseDate(startsAtInUtc);
  let daylightSavingsOffset = 0;

  if (!isEqualDate(startsAt, inputStartsAt) && isEqualDate(startsAtInUtc, startsAtInUtcInitial)) {
    // in some cases where daylight savings ends (november 3rd), 
    // the input startsAt time will not be properly recovered due to loss of timezone information
    // (cannot determine whether or not to apply the -5 or -6 offset after daylight savings ends)
    daylightSavingsOffset = differenceInHours(inputStartsAt, startsAt);
    startsAt = addHours(startsAt, daylightSavingsOffset);

    // startsAtInUtc = addHours(startsAtInUtc, 1);
  }
  */

  const lastStartsAtInBaseTimezone = addHours(startsAtInUtc, numberOfDayBlocks * 24 + daylightSavingsOffset); // use addHours instead of addDays, since addDays will take into account a daylight savings change if the system time changes

  // calculate end to be the ending date/time of the final duration span
  const lastStartInTarget = normalInstance.targetDateToBaseDate(lastStartsAtInBaseTimezone);
  const end: Date = addMinutes(lastStartInTarget, duration);

  console.log({ lastStartsAtInBaseTimezone, inputStartsAt, startsAtInUtcInitial, startsAtInUtc, startsAt, daylightSavingsOffset, start, lastStartInTarget, end });

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
 * Returns true if the two DateCellTimingStartsAtEndRange values are the same.
 *
 * @param a
 * @param b
 */
export function isSameDateCellTimingEventStartsAtEndRange(a: Maybe<DateCellTimingStartsAtEndRange>, b: Maybe<DateCellTimingStartsAtEndRange>): boolean {
  return a && b ? a.timezone === b.timezone && isSameDate(a.startsAt, b.startsAt) && isSameDate(a.end, b.end) : a == b;
}

/**
 * Returns true if the two timings are equivalent.
 *
 * @param a
 * @param b
 */
export function isSameDateCellTiming(a: Maybe<DateCellTiming>, b: Maybe<DateCellTiming>): boolean {
  return a && b ? a.duration === b.duration && isSameDateCellTimingEventStartsAtEndRange(a, b) : a == b;
}

/**
 * Returns true if all variables in the input FullDateCellTimings are exact.
 *
 * In most cases this comparison is unnecessary, as the start date is derived from the startsAt time.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameFullDateCellTiming(a: Maybe<FullDateCellTiming>, b: Maybe<FullDateCellTiming>): boolean {
  return a && b ? isSameDate(a.start, b.start) && isSameDateCellTiming(a, b) : a == b;
}

/**
 * Returns true if the input is a DateCellTiming.
 *
 * Does not check if it is a valid DateCellTiming.
 *
 * @param input
 */
export function isDateCellTiming(input: unknown): input is DateCellTiming {
  if (typeof input === 'object') {
    const asTiming = input as DateCellTiming;
    return isDate(asTiming.startsAt) && isDate(asTiming.end) && typeof asTiming.timezone === 'string' && typeof asTiming.duration === 'number';
  }

  return false;
}

/**
 * Returns true if the input is possibly a FullDateCellTiming.
 *
 * Does not check if it is a valid FullDateCellTiming.
 *
 * @param input
 */
export function isFullDateCellTiming(input: unknown): input is FullDateCellTiming {
  if (typeof input === 'object') {
    const asTiming = input as FullDateCellTiming;
    return isDate(asTiming.start) && isDateCellTiming(asTiming);
  }

  return false;
}

/**
 * Creates a DateCellTimingDateRange from the input timing. Contains the start of the day in that timezone as the start date, and the end time for the final event.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingDateRange(timing: DateCellTimingStartsAtEndRange): DateCellTimingDateRange {
  const start = dateCellTimingStart(timing);
  return { start, end: timing.end, timezone: timing.timezone };
}

/**
 * Returns the date range from the start of the first event to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingEventRange(timing: Pick<DateCellTiming, 'startsAt' | 'end' | 'timezone'>): DateCellTimingEventRange {
  return { start: timing.startsAt, end: timing.end, timezone: timing.timezone };
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
 * Returns a copy of the input timing with the start date adjusted and the new timezone set.
 *
 * The startsAt time remains the same, while the end date may be updated to reflect timezone differences.
 */
export type UpdateDateCellTimingToTimezoneFunction = (<T extends DateCellTimingStartsAtEndRange>(timing: T) => T & FullDateCellTiming) & {
  readonly _timezone: TimezoneString;
};

/**
 * Creates a ChangeDateCellTimingToTimezoneFunction from the input.
 *
 * @param input
 * @returns
 */
export function updateDateCellTimingToTimezoneFunction(timezone: TimezoneString): UpdateDateCellTimingToTimezoneFunction {
  const fn = (<T extends DateCellTimingStartsAtEndRange>(timing: T) => {
    const { startsAt } = timing;
    const newTiming: T = {
      ...timing,
      start: dateCellTimingStart({ startsAt, timezone }),
      timezone
    };

    return newTiming;
  }) as Building<UpdateDateCellTimingToTimezoneFunction>;
  fn._timezone = timezone;
  return fn as UpdateDateCellTimingToTimezoneFunction;
}

/**
 * Convenience function for calling updateDateCellTimingToTimezone() with the system timezone.
 *
 * @param timing
 * @returns
 */
export function updateDateCellTimingToSystemTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return updateDateCellTimingToTimezone(timing, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.configuredTimezoneString as string);
}

/**
 * Convenience function for calling updateDateCellTimingToTimezone() with the UTC timezone.
 *
 * @param timing
 * @returns
 */
export function updateDateCellTimingToUTCTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return updateDateCellTimingToTimezone(timing, UTC_TIMEZONE_STRING);
}

/**
 * Convenience function for calling updateDateCellTimingToTimezoneFunction() and passing the timing.
 *
 * @param timing
 * @param timezone
 * @returns
 */
export function updateDateCellTimingToTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T, timezone: TimezoneString): T {
  return updateDateCellTimingToTimezoneFunction(timezone)(timing);
}

/**
 * Returns a copy of the input timing adjusted for the input timezone and all FullDateCellTiming values updated to reflect the changes.
 *
 * The startsAt and end times are adjusted to match the same "time" in the new timezone. I.E: A timing of 8AM UTC that is converted to America/Denver would be converted to 8AM America/Denver.
 *
 * @param timing
 */
export type ShiftDateCellTimingToTimezoneFunction = (<T extends DateCellTimingStartsAtEndRange>(timing: T) => T & FullDateCellTiming) & {
  readonly _normalInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a ChangeDateCellTimingToTimezoneFunction from the input.
 *
 * @param input
 * @returns
 */
export function shiftDateCellTimingToTimezoneFunction(timezoneInput: DateCellTimingTimezoneInput): ShiftDateCellTimingToTimezoneFunction {
  const normalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
  const timezone = normalInstance.configuredTimezoneString as string;

  const fn = (<T extends DateCellTimingStartsAtEndRange>(timing: T) => {
    const inputTimingNormalInstance = dateCellTimingTimezoneNormalInstance(timing);
    const startsAtNormal = inputTimingNormalInstance.baseDateToTargetDate(timing.startsAt);
    const endNormal = inputTimingNormalInstance.baseDateToTargetDate(timing.end);

    const startsAt = normalInstance.targetDateToBaseDate(startsAtNormal);
    const end = normalInstance.targetDateToBaseDate(endNormal);

    const newTiming: T = {
      ...timing,
      start: dateCellTimingStart({ startsAt, timezone }),
      timezone,
      startsAt,
      end
    };

    return newTiming;
  }) as Building<ShiftDateCellTimingToTimezoneFunction>;
  fn._normalInstance = normalInstance;
  return fn as ShiftDateCellTimingToTimezoneFunction;
}

/**
 * Convenience function for calling shiftDateCellTimingToTimezone() with the system timezone.
 *
 * @param timing
 * @returns
 */
export function shiftDateCellTimingToSystemTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return shiftDateCellTimingToTimezone(timing, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
}

/**
 * Convenience function for calling shiftDateCellTimingToTimezone() with the UTC timezone.
 *
 * @param timing
 * @returns
 */
export function shiftDateCellTimingToUTCTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return shiftDateCellTimingToTimezone(timing, UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
}

/**
 * Convenience function for calling shiftDateCellTimingToTimezoneFunction() and passing the timing.
 *
 * @param timing
 * @param timezone
 * @returns
 */
export function shiftDateCellTimingToTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T, timezone: DateCellTimingTimezoneInput): T {
  return shiftDateCellTimingToTimezoneFunction(timezone)(timing);
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

  let startsAtInUtcNormal = normalInstance.baseDateToTargetDate(startsAt); // convert to UTC normal
  let endInUtcNormal = normalInstance.baseDateToTargetDate(end);

  const { daylightSavingsOffset: startDaylightSavingsOffset } = normalInstance.safeMirroredConvertDate(startsAtInUtcNormal, startsAt, 'target');
  const { daylightSavingsOffset: endDaylightSavingsOffset } = normalInstance.safeMirroredConvertDate(endInUtcNormal, end, 'target');

  if (startDaylightSavingsOffset) {
    startsAtInUtcNormal = addHours(startsAtInUtcNormal, startDaylightSavingsOffset);
  }

  if (endDaylightSavingsOffset) {
    endInUtcNormal = addHours(endInUtcNormal, endDaylightSavingsOffset);
  }

  const finalMsDifferenceBetweenStartAndEnd = differenceInMilliseconds(endInUtcNormal, startsAtInUtcNormal);
  const duration = (finalMsDifferenceBetweenStartAndEnd / MS_IN_MINUTE) % MINUTES_IN_DAY || MINUTES_IN_DAY;
  const expectedFinalStartsAtUtc = addMinutes(endInUtcNormal, -duration);
  const expectedFinalStartsAt = normalInstance.targetDateToBaseDate(expectedFinalStartsAtUtc); // 2024-11-03T03:00:00.000Z

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
export function dateCellTimingFinalStartsAtEvent(timing: DateCellTimingStartsAtEndRange): DateCellTimingEvent {
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
