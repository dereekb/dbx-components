import { type Minutes, type Hours, type Days, type Maybe, DATE_NOW_VALUE } from '@dereekb/util';
import { addMinutes, isBefore } from 'date-fns';
import { daysToMinutes, isAfter, roundDownToMinute, takeNextUpcomingTime } from './date';
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
 * Used for deriving a limit for the current instant in time.
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
    return this._config.instant || 'now';
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

    if (typeof max !== 'string' && isPast) {
      if (!max || isBefore(max, instant)) {
        limit = DATE_NOW_VALUE;
      }
    }

    return limit;
  }

  /**
   * Creates a date range for now.
   *
   * @returns
   */
  dateRange(): Partial<DateRange> {
    const { instant = new Date() } = this._config;
    return this.dateRangeForInstant(instant);
  }

  dateRangeForInstant(instant: Date) {
    const { min, max } = this;
    return {
      start: min ? dateFromLogicalDate(min, instant) : undefined,
      end: max ? dateFromLogicalDate(max, instant) : undefined
    };
  }

  /**
   * Clamps the input date to the current range.
   */
  clamp(date: Date): Date {
    let result: Date = date;

    const dateRange = this.dateRange();
    result = clampDateToDateRange(date, dateRange);

    if (this._config.takeNextUpcomingTime) {
      result = takeNextUpcomingTime(result, this._config.roundDownToMinute ?? false);
    } else if (this._config.roundDownToMinute) {
      result = roundDownToMinute(result);
    }

    return result;
  }

  clampDateRange(dateRange: DateRange): DateRange {
    return clampDateRangeToDateRange(dateRange, this.dateRange()) as DateRange;
  }
}

export function limitDateTimeInstance(config: LimitDateTimeConfig): LimitDateTimeInstance {
  return new LimitDateTimeInstance(config);
}
