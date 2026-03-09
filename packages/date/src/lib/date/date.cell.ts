import { type IndexRef, MINUTES_IN_DAY, MS_IN_DAY, type Maybe, type TimezoneString, type Building, type Minutes, minutesToFractionalHours, type FractionalHour, type TimezoneStringRef, MS_IN_MINUTE, type ISO8601DayString, UTC_TIMEZONE_STRING, startOfDayForUTCDateInUTC, isEqualDate } from '@dereekb/util';
import { type DateRange, type DateRangeDayDistanceInput, isDateRange } from './date.range';
import { type DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addMinutes, getSeconds, getMilliseconds, getMinutes, isAfter, startOfDay, addHours } from 'date-fns';
import { roundDownToMinute, isSameDate, isDate, requireCurrentTimezone, copyHoursAndMinutesFromUTCDate } from './date';
import { type DateTimezoneUtcNormalFunctionInput, type DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE, systemDateTimezoneUtcNormal, UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';
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
 * Returns true if the index is a non-negative integer, which is required for valid date cell indexing.
 *
 * @param input - the index to validate
 * @returns whether the input is a valid date cell index (>= 0 and an integer)
 *
 * @example
 * ```ts
 * isValidDateCellIndex(0); // true
 * isValidDateCellIndex(5); // true
 * isValidDateCellIndex(-1); // false
 * isValidDateCellIndex(0.5); // false
 * ```
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

/**
 * Normalizes a number or {@link DateCell} to a DateCell object.
 *
 * @param dateCellOrIndex - a numeric index or existing DateCell
 * @returns a DateCell object with the `i` property set
 *
 * @example
 * ```ts
 * dateCell(3); // { i: 3 }
 * dateCell({ i: 3 }); // { i: 3 } (returned as-is)
 * ```
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
 * Creates a {@link DateCellTimingStartsAt} positioned at the start of the current day in the given timezone.
 *
 * Useful for initializing a timing range that begins "today" in a particular timezone.
 *
 * @param input - optional timezone and "now" override
 * @returns a DateCellTimingStartsAt with startsAt at midnight and the resolved timezone
 *
 * @example
 * ```ts
 * const timing = dateCellTimingStartsAtForStartOfDay({ timezone: 'America/Denver' });
 * // timing.startsAt is midnight today in Denver, timing.timezone === 'America/Denver'
 * ```
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
 * Creates a {@link DateTimezoneUtcNormalInstance} from the input, guaranteeing that a timezone string is configured.
 *
 * Falls back to the system timezone if no input is provided.
 *
 * @param timezoneInput - timezone configuration or undefined for system timezone
 * @returns a DateTimezoneUtcNormalInstance with a guaranteed configured timezone
 * @throws {Error} When the timezone cannot be resolved to a known timezone string.
 *
 * @example
 * ```ts
 * const instance = dateCellTimingTimezoneNormalInstance('America/Denver');
 * instance.configuredTimezoneString; // 'America/Denver'
 * ```
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
 * Derives a {@link FullDateCellTiming} from a {@link DateCellTiming} by computing the `start` date (midnight in the timing's timezone).
 *
 * @param timing - the base timing to expand
 * @returns the timing with the `start` field populated
 *
 * @example
 * ```ts
 * const timing: DateCellTiming = { startsAt, end, duration: 60, timezone: 'America/Denver' };
 * const full = fullDateCellTiming(timing);
 * // full.start is midnight for the startsAt day in Denver
 * ```
 */
export function fullDateCellTiming(timing: DateCellTiming): FullDateCellTiming {
  return fullDateCellTimingTimezonePair(timing).fullTiming;
}

export interface FullDateCellTimingTimezonePair {
  readonly fullTiming: FullDateCellTiming;
  readonly normalInstance: DateTimezoneUtcNormalInstance;
}

/**
 * Creates a {@link FullDateCellTimingTimezonePair} containing both the expanded timing and the timezone normal instance.
 *
 * Useful when both the full timing and the timezone conversion utilities are needed together.
 *
 * @param timing - the base timing to expand
 * @returns the full timing paired with its timezone normal instance
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
 * Validates that a date has zero minutes, seconds, and milliseconds, which is required for a valid DateCellTiming start date (midnight in the target timezone).
 *
 * @param date - the start date to validate
 * @returns whether the date is at a valid hour boundary
 *
 * @example
 * ```ts
 * isValidDateCellTimingStartDate(new Date('2024-01-01T06:00:00.000Z')); // true
 * isValidDateCellTimingStartDate(new Date('2024-01-01T06:30:00.000Z')); // false
 * ```
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
  const { date: startsAt, daylightSavingsOffset } = normalInstance.safeMirroredConvertDate(startsAtInUtc, inputStartsAt, 'target', safeMirror);

  // calculate end to be the ending date/time of the final duration span
  const lastStartsAtInBaseTimezone = addHours(startsAtInUtc, numberOfDayBlocks * 24 + daylightSavingsOffset); // use addHours instead of addDays, since addDays will take into account a daylight savings change if the system time changes
  const lastStartInTarget = normalInstance.targetDateToBaseDate(lastStartsAtInBaseTimezone);
  const end: Date = addMinutes(lastStartInTarget, duration);

  // console.log({ lastStartsAtInBaseTimezone, inputStartsAt, startsAtInUtcInitial, startsAtInUtc, startsAt, daylightSavingsOffset, start, lastStartInTarget, end });

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
 * Computes the start-of-day date for a timing and returns it paired with the timezone normal instance.
 *
 * @param timing - timing with startsAt and timezone
 * @returns the midnight start date and the timezone normal instance used to compute it
 */
export function dateCellTimingStartPair(timing: DateCellTimingStartsAt): DateCellTimingStartPair {
  const { startsAt, timezone } = timing;
  const normalInstance = dateTimezoneUtcNormal(timezone);

  // convert to target-date form (wall clock as UTC), floor to midnight via pure UTC math,
  // then convert back to real UTC. Avoids system-timezone-dependent startOfDay which breaks
  // on DST day when system and target timezones transition at different UTC times.
  const startsAtAsTarget = normalInstance.baseDateToTargetDate(startsAt);
  const startOfDayAsTarget = startOfDayForUTCDateInUTC(startsAtAsTarget);
  const start = normalInstance.targetDateToBaseDate(startOfDayAsTarget);

  return {
    start,
    normalInstance
  };
}

/**
 * Computes the start-of-day (midnight) date for a {@link DateCellTimingStartsAt} in its configured timezone.
 *
 * @param timing - timing with startsAt and timezone
 * @returns the midnight Date for the timing's first day in its timezone
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
 * Null-safe equality check for two {@link DateCellTimingStartsAtEndRange} values, comparing timezone, startsAt, and end.
 *
 * @param a - first range
 * @param b - second range
 * @returns whether the two ranges are equivalent
 */
export function isSameDateCellTimingEventStartsAtEndRange(a: Maybe<DateCellTimingStartsAtEndRange>, b: Maybe<DateCellTimingStartsAtEndRange>): boolean {
  return a && b ? a.timezone === b.timezone && isSameDate(a.startsAt, b.startsAt) && isSameDate(a.end, b.end) : a == b;
}

/**
 * Null-safe equality check for two {@link DateCellTiming} values, comparing duration and the starts-at/end range.
 *
 * @param a - first timing
 * @param b - second timing
 * @returns whether the two timings are equivalent
 */
export function isSameDateCellTiming(a: Maybe<DateCellTiming>, b: Maybe<DateCellTiming>): boolean {
  return a && b ? a.duration === b.duration && isSameDateCellTimingEventStartsAtEndRange(a, b) : a == b;
}

/**
 * Strict equality check for {@link FullDateCellTiming} values, including the derived `start` date.
 *
 * In most cases {@link isSameDateCellTiming} is sufficient since `start` is derived from `startsAt`.
 *
 * @param a - first full timing
 * @param b - second full timing
 * @returns whether all fields are exactly equal
 */
export function isSameFullDateCellTiming(a: Maybe<FullDateCellTiming>, b: Maybe<FullDateCellTiming>): boolean {
  return a && b ? isSameDate(a.start, b.start) && isSameDateCellTiming(a, b) : a == b;
}

/**
 * Type guard that checks whether the input has the shape of a {@link DateCellTiming} (startsAt, end, timezone, duration).
 *
 * Does not validate correctness (e.g. end after start). Use {@link isValidDateCellTiming} for validation.
 *
 * @param input - value to check
 * @returns whether the input matches the DateCellTiming shape
 */
export function isDateCellTiming(input: unknown): input is DateCellTiming {
  if (typeof input === 'object') {
    const asTiming = input as DateCellTiming;
    return isDate(asTiming.startsAt) && isDate(asTiming.end) && typeof asTiming.timezone === 'string' && typeof asTiming.duration === 'number';
  }

  return false;
}

/**
 * Type guard that checks whether the input has the shape of a {@link FullDateCellTiming} (includes `start` field plus all DateCellTiming fields).
 *
 * Does not validate correctness. Use {@link isValidFullDateCellTiming} for validation.
 *
 * @param input - value to check
 * @returns whether the input matches the FullDateCellTiming shape
 */
export function isFullDateCellTiming(input: unknown): input is FullDateCellTiming {
  if (typeof input === 'object') {
    const asTiming = input as FullDateCellTiming;
    return isDate(asTiming.start) && isDateCellTiming(asTiming);
  }

  return false;
}

/**
 * Derives a {@link DateCellTimingDateRange} from a timing, using midnight in the timing's timezone as the start and the event's end time as the end.
 *
 * @param timing - timing with startsAt, end, and timezone
 * @returns a date range spanning from midnight of the first day to the end of the last event
 */
export function dateCellTimingDateRange(timing: DateCellTimingStartsAtEndRange): DateCellTimingDateRange {
  const start = dateCellTimingStart(timing);
  return { start, end: timing.end, timezone: timing.timezone };
}

/**
 * Returns a {@link DateCellTimingEventRange} spanning from the first event's startsAt to the last event's end time.
 *
 * Unlike {@link dateCellTimingDateRange}, the start is the event time rather than midnight.
 *
 * @param timing - timing with startsAt, end, and timezone
 * @returns the event range
 */
export function dateCellTimingEventRange(timing: Pick<DateCellTiming, 'startsAt' | 'end' | 'timezone'>): DateCellTimingEventRange {
  return { start: timing.startsAt, end: timing.end, timezone: timing.timezone };
}

/**
 * Returns the date range of the first event only (from startsAt to startsAt + duration).
 *
 * @param timing - timing to extract the first event from
 * @returns date range of the first event
 */
export function getDateCellTimingFirstEventDateRange(timing: DateCellTimingStartsAtEndRange): DateRange {
  const duration = calculateExpectedDateCellTimingDuration(timing);
  const end = addMinutes(timing.startsAt, duration);
  return { start: timing.startsAt, end };
}

/**
 * Converts a timing's duration from minutes to fractional hours.
 *
 * @param timing - timing with a duration in minutes
 * @returns the duration expressed as fractional hours (e.g. 90 minutes = 1.5)
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
 * Creates a function that updates a timing's timezone and recalculates the `start` date, while preserving the original `startsAt` instant.
 *
 * The event occurs at the same absolute moment in time, but is now associated with a different timezone.
 *
 * @param timezone - the new IANA timezone to apply
 * @returns a function that updates timings to the new timezone
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
 * Updates the timing's timezone to the system timezone while preserving the absolute startsAt instant.
 *
 * @param timing - timing to update
 * @returns the timing with the system timezone applied
 */
export function updateDateCellTimingToSystemTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return updateDateCellTimingToTimezone(timing, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.configuredTimezoneString as string);
}

/**
 * Updates the timing's timezone to UTC while preserving the absolute startsAt instant.
 *
 * @param timing - timing to update
 * @returns the timing with UTC timezone applied
 */
export function updateDateCellTimingToUTCTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return updateDateCellTimingToTimezone(timing, UTC_TIMEZONE_STRING);
}

/**
 * Updates a timing's timezone while preserving the absolute startsAt instant.
 *
 * Shorthand for creating an {@link updateDateCellTimingToTimezoneFunction} and immediately invoking it.
 *
 * @param timing - timing to update
 * @param timezone - the new IANA timezone
 * @returns the timing with the new timezone applied
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
 * Creates a function that shifts a timing's startsAt and end to represent the same "wall clock time" in a new timezone.
 *
 * Unlike {@link updateDateCellTimingToTimezoneFunction}, which preserves the absolute instant, this shifts the absolute times
 * so the local time appearance remains the same (e.g. 8AM UTC becomes 8AM Denver).
 *
 * @param timezoneInput - the target timezone to shift into
 * @returns a function that shifts timings into the new timezone
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
 * Shifts a timing to the system timezone, preserving the wall clock time appearance.
 *
 * @param timing - timing to shift
 * @returns the timing shifted to the system timezone
 */
export function shiftDateCellTimingToSystemTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return shiftDateCellTimingToTimezone(timing, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
}

/**
 * Shifts a timing to UTC, preserving the wall clock time appearance.
 *
 * @param timing - timing to shift
 * @returns the timing shifted to UTC
 */
export function shiftDateCellTimingToUTCTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T): T {
  return shiftDateCellTimingToTimezone(timing, UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
}

/**
 * Shifts a timing to a new timezone, preserving the wall clock time appearance.
 *
 * Shorthand for creating a {@link shiftDateCellTimingToTimezoneFunction} and immediately invoking it.
 *
 * @param timing - timing to shift
 * @param timezone - the target timezone
 * @returns the timing shifted to the new timezone
 */
export function shiftDateCellTimingToTimezone<T extends DateCellTimingStartsAtEndRange>(timing: T, timezone: DateCellTimingTimezoneInput): T {
  return shiftDateCellTimingToTimezoneFunction(timezone)(timing);
}

export interface CalculateExpectedDateCellTimingDurationPair {
  readonly duration: Minutes;
  readonly expectedFinalStartsAt: Date;
}

function _calculateExpectedDateCellTimingDurationPair(timing: DateCellTimingStartsAtEndRange) {
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

  return {
    duration,
    normalInstance,
    endInUtcNormal
  };
}

/**
 * Calculates the expected duration and the final event's startsAt from a timing range, accounting for DST transitions.
 *
 * @param timing - the timing range to analyze
 * @returns the computed duration in minutes and the expected startsAt of the last event
 */
export function calculateExpectedDateCellTimingDurationPair(timing: DateCellTimingStartsAtEndRange): CalculateExpectedDateCellTimingDurationPair {
  const { duration, normalInstance, endInUtcNormal } = _calculateExpectedDateCellTimingDurationPair(timing);
  const expectedFinalStartsAtUtc = addMinutes(endInUtcNormal, -duration);
  const expectedFinalStartsAt = normalInstance.targetDateToBaseDate(expectedFinalStartsAtUtc); // 2024-11-03T03:00:00.000Z

  return {
    duration,
    expectedFinalStartsAt
  };
}

/**
 * Calculates the expected event duration in minutes from a timing range by analyzing the gap between startsAt and end.
 *
 * @param timing - the timing range to analyze
 * @returns the duration in minutes
 */
export function calculateExpectedDateCellTimingDuration(timing: DateCellTimingStartsAtEndRange): Minutes {
  return _calculateExpectedDateCellTimingDurationPair(timing).duration;
}

/**
 * Converts a {@link DateCellTimingStartsAtEndRange} to a full {@link DateCellTiming} by computing the duration from the range.
 *
 * @param timing - the starts-at/end range to convert
 * @returns a DateCellTiming with the calculated duration
 */
export function dateCellTimingFromDateCellTimingStartsAtEndRange(timing: DateCellTimingStartsAtEndRange): DateCellTiming {
  const { startsAt, end, timezone } = timing;
  const duration = calculateExpectedDateCellTimingDuration(timing);
  return {
    startsAt,
    duration,
    end,
    timezone
  };
}

/**
 * Computes the startsAt time and duration for the final event in a timing range.
 *
 * @param timing - the timing range to analyze
 * @returns a DateCellTimingEvent representing the last scheduled event
 */
export function dateCellTimingFinalStartsAtEvent(timing: DateCellTimingStartsAtEndRange): DateCellTimingEvent {
  const { duration, expectedFinalStartsAt: startsAt } = calculateExpectedDateCellTimingDurationPair(timing);
  return {
    startsAt,
    duration
  };
}

/**
 * Detailed validation result for a {@link DateCellTiming}, with individual boolean flags for each validation rule.
 */
export interface IsValidDateCellTimingInfo {
  readonly isValid: boolean;
  readonly startsAtHasZeroSeconds: boolean;
  readonly endIsAfterTheStartsAtTime: boolean;
  readonly durationGreaterThanZero: boolean;
  readonly durationLessThan24Hours: boolean;
  readonly isExpectedValidEnd: boolean;
  readonly normalInstance: DateTimezoneUtcNormalInstance;
}

/**
 * Performs detailed validation of a {@link DateCellTiming}, returning an info object with individual check results.
 *
 * Validates that end is after startsAt, duration is within bounds, startsAt has no fractional seconds, and the computed duration matches the expected value.
 *
 * @param timing - the timing to validate
 * @returns detailed validation info with individual boolean flags
 */
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
 * Returns true if the {@link DateCellTiming} passes all validation checks.
 *
 * Shorthand for {@link isValidDateCellTimingInfo} when only the boolean result is needed.
 *
 * @param timing - the timing to validate
 * @returns whether the timing is valid
 */
export function isValidDateCellTiming(timing: DateCellTiming): boolean {
  const { isValid } = isValidDateCellTimingInfo(timing);
  return isValid;
}

/**
 * Extended validation result for a {@link FullDateCellTiming}, adding checks for the derived `start` date alignment.
 */
export interface IsValidFullDateCellTimingInfo extends IsValidDateCellTimingInfo {
  readonly isStartRoundedToSeconds: boolean;
  readonly startIsAtMidnight: boolean;
  readonly startHasZeroSeconds: boolean;
  readonly startsAtIsAfterStart: boolean;
  readonly startsAtIsLessThan24HoursAfterStart: boolean;
}

/**
 * Performs detailed validation of a {@link FullDateCellTiming}, including all {@link isValidDateCellTimingInfo} checks
 * plus additional checks that the `start` date is at midnight and properly aligned with `startsAt`.
 *
 * @param timing - the full timing to validate
 * @returns detailed validation info with individual boolean flags
 */
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

/**
 * Returns true if the {@link FullDateCellTiming} passes all validation checks, including start date alignment.
 *
 * Shorthand for {@link isValidFullDateCellTimingInfo} when only the boolean result is needed.
 *
 * @param timing - the full timing to validate
 * @returns whether the timing is valid
 */
export function isValidFullDateCellTiming(timing: FullDateCellTiming): boolean {
  const { isValid } = isValidFullDateCellTimingInfo(timing);
  return isValid;
}
