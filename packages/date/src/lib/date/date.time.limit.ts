import { Minutes, Hours, Days, LogicalDate, DATE_NOW_VALUE, Maybe } from "@dereekb/util";
import { addMinutes, isBefore, min as minDate, max as maxDate } from "date-fns";
import { daysToMinutes, isAfter, roundDownToMinute, takeNextUpcomingTime } from "./date";

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
    min?: Date;

    /**
     * The maximum date allowed.
     */
    max?: Date;

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
    }

  };

}

/**
 * Used for deriving a limit for the current instant in time.
 */
export class LimitDateTimeInstance {

  constructor(readonly config: LimitDateTimeConfig = {}) { }

  get instant(): LogicalDate {
    return this.config.instant || 'now';
  }

  get minimumMinutesIntoFuture(): Maybe<Minutes> {
    const { limits = {} } = this.config;
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
    const { instant = new Date(), limits = {} } = this.config;
    const { isFuture, future, min } = limits;

    let limit: Maybe<LogicalDate> = min;

    if (future || isFuture) {
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
    const { instant = new Date(), limits = {} } = this.config;
    const { isPast, max } = limits;

    let limit: Maybe<LogicalDate> = max;

    if (isPast) {
      if (!max || isBefore(max, instant)) {
        limit = DATE_NOW_VALUE;
      }
    }

    return limit;
  }

  /**
   * Limits the input date to the current time.
   */
  limit(date: Date): Date {
    const { min, max } = this;
    const now = new Date();

    let result: Date = date;

    if (min) {
      if (min === DATE_NOW_VALUE) {
        result = isAfter(date, now) ? now : date;
      } else {
        result = maxDate([date, min]);
      }
    }

    if (max) {
      if (max === DATE_NOW_VALUE) {
        result = isBefore(date, now) ? now : date;
      } else {
        result = minDate([date, max]);
      }
    }

    if (this.config.takeNextUpcomingTime) {
      result = takeNextUpcomingTime(result, this.config.roundDownToMinute ?? false);
    } else if (this.config.roundDownToMinute) {
      result = roundDownToMinute(result);
    }

    return result;
  }

}
