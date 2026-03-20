import { type Minutes, type Hours, type Days, type Maybe, DATE_NOW_VALUE } from '@dereekb/util';
import { addDays, addMinutes, isBefore, isPast } from 'date-fns';
import { daysToMinutes, isAfter, roundDownToMinute, copyHoursAndMinutesToDate } from './date';
import { type DateRange, clampDateRangeToDateRange, clampDateToDateRange } from './date.range';
import { type LogicalDate, dateFromLogicalDate } from './date.logical';

export interface LimitDateTimeConfig {
  /**
   * The relative instant to use when deriving limits.
   */
  instant?: Date;

  /**
   * Whether or not to take the next upcoming time of the input.
   */
  takeNextUpcomingTime?: boolean;

  /**
   * Whether or not to round the date down to the nearest minute.
   */
  roundDownToMinute?: boolean;

  /**
   * Limits to use for this configuration.
   */
  limits?: {
    /**
     * The minimum date allowed.
     */
    min?: Maybe<LogicalDate>;

    /**
     * The maximum date allowed.
     */
    max?: Maybe<LogicalDate>;

    /**
     * The date must be in the future.
     */
    isFuture?: boolean;

    /**
     * The date must be in the past.
     */
    isPast?: boolean;

    /**
     * Minimum limits derived from the future.
     */
    future?: {
      minutes?: Minutes;
      hours?: Hours;
      days?: Days;
    };
  };
}

/**
 * Derives min/max date boundaries from a {@link LimitDateTimeConfig} and provides clamping
 * utilities for constraining dates and date ranges within those boundaries.
 *
 * Supports dynamic limits based on the current time (e.g., "must be in the future",
 * "must be at least N minutes from now") as well as static min/max bounds.
 *
 * @example
 * ```ts
 * const limiter = new LimitDateTimeInstance({
 *   limits: { isFuture: true, future: { hours: 2 } }
 * });
 *
 * const range = limiter.dateRange(); // { start: <2 hours from now>, end: undefined }
 * const clamped = limiter.clamp(someDate);
 * ```
 */
export class LimitDateTimeInstance {
  private readonly _config: LimitDateTimeConfig;

  constructor(config: LimitDateTimeConfig = {}) {
    this._config = config;
  }

  get config() {
    return this._config;
  }

  get instant(): LogicalDate {
    return this._config.instant ?? 'now';
  }

  get minimumMinutesIntoFuture(): Maybe<Minutes> {
    const { limits = {} } = this._config;
    const { future } = limits;
    let minutes: Maybe<Minutes>;

    if (future) {
      minutes = future.minutes ?? 0;

      if (future.hours) {
        minutes += Math.floor(future.hours * 60);
      }

      if (future.days) {
        minutes += Math.floor(daysToMinutes(future.days));
      }
    }

    return minutes;
  }

  get min(): Maybe<LogicalDate> {
    const { instant = new Date(), limits = {} } = this._config;
    const { isFuture, future, min } = limits;

    let limit: Maybe<LogicalDate> = min;

    if (typeof min !== 'string' && (future || isFuture)) {
      if (!min || isAfter(min, instant)) {
        limit = DATE_NOW_VALUE;
      } else if (future) {
        const minimumMinutesIntoFuture = this.minimumMinutesIntoFuture;
        limit = addMinutes(instant, minimumMinutesIntoFuture ?? 0);
      }
    }

    return limit;
  }

  get max(): Maybe<LogicalDate> {
    const { instant = new Date(), limits = {} } = this._config;
    const { isPast, max } = limits;

    let limit: Maybe<LogicalDate> = max;

    if (typeof max !== 'string' && isPast && (!max || isBefore(max, instant))) {
      limit = DATE_NOW_VALUE;
    }

    return limit;
  }

  /**
   * Computes the allowed date range based on the configured limits, evaluated at the
   * config's instant (or now if not set).
   *
   * @example
   * ```ts
   * const limiter = new LimitDateTimeInstance({ limits: { isFuture: true } });
   * const range = limiter.dateRange(); // { start: <now>, end: undefined }
   * ```
   *
   * @returns A partial {@link DateRange} with `start` and/or `end` derived from the limits.
   */
  dateRange(): Partial<DateRange> {
    const { instant = new Date() } = this._config;
    return this.dateRangeForInstant(instant);
  }

  /**
   * Computes the allowed date range evaluated at a specific instant, allowing limits
   * like "now" or relative future offsets to resolve against the given moment.
   *
   * @param instant - The reference point in time for resolving dynamic limits.
   * @returns A partial {@link DateRange} resolved against the given instant.
   */
  dateRangeForInstant(instant: Date) {
    const { min, max } = this;
    return {
      start: min ? dateFromLogicalDate(min, instant) : undefined,
      end: max ? dateFromLogicalDate(max, instant) : undefined
    };
  }

  /**
   * Clamps the input date to the allowed range, optionally applying `takeNextUpcomingTime`
   * (copies time to today, advancing to tomorrow if already past) or `roundDownToMinute`.
   *
   * @param date - The date to constrain.
   *
   * @example
   * ```ts
   * const limiter = new LimitDateTimeInstance({
   *   limits: { isFuture: true, future: { minutes: 30 } }
   * });
   * const safe = limiter.clamp(new Date()); // at least 30 minutes from now
   * ```
   *
   * @returns The clamped date within the allowed range.
   */
  clamp(date: Date): Date {
    let result: Date = date;

    const dateRange = this.dateRange();
    result = clampDateToDateRange(date, dateRange);

    if (this._config.takeNextUpcomingTime) {
      // Inline implementation of deprecated takeNextUpcomingTime
      // Copy hours/minutes from result to today, then add a day if it's in the past
      const roundDownToMinute = this._config.roundDownToMinute ?? false;
      result = copyHoursAndMinutesToDate(
        {
          hours: result.getHours(),
          minutes: result.getMinutes(),
          roundDownToMinute
        },
        new Date()
      );

      if (isPast(result)) {
        result = addDays(result, 1);
      }
    } else if (this._config.roundDownToMinute) {
      result = roundDownToMinute(result);
    }

    return result;
  }

  /**
   * Clamps an entire date range to fit within the allowed limits, constraining both
   * start and end dates.
   *
   * @param dateRange - The date range to constrain.
   *
   * @example
   * ```ts
   * const limiter = new LimitDateTimeInstance({ limits: { isFuture: true } });
   * const clamped = limiter.clampDateRange({ start: pastDate, end: futureDate });
   * // clamped.start will be at least now
   * ```
   *
   * @returns The date range clamped to the allowed limits.
   */
  clampDateRange(dateRange: DateRange): DateRange {
    return clampDateRangeToDateRange(dateRange, this.dateRange()) as DateRange;
  }
}

/**
 * Factory function that creates a {@link LimitDateTimeInstance} from the given configuration.
 *
 * @param config - The limit configuration specifying bounds, future requirements, and rounding.
 *
 * @example
 * ```ts
 * const limiter = limitDateTimeInstance({
 *   limits: { min: new Date('2024-01-01'), isFuture: true },
 *   roundDownToMinute: true
 * });
 * const clamped = limiter.clamp(someDate);
 * ```
 *
 * @returns A new {@link LimitDateTimeInstance}.
 */
export function limitDateTimeInstance(config: LimitDateTimeConfig): LimitDateTimeInstance {
  return new LimitDateTimeInstance(config);
}
