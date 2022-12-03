import { dateFromLogicalDate, Minutes, DecisionFunction } from '@dereekb/util';
import { addMinutes, isAfter, set, isBefore } from 'date-fns';
import { roundDownToMinute } from './date';
import { roundDateTimeDownToSteps, StepRoundDateTimeDown } from './date.round';
import { DateSchedule, dateScheduleDateFilter, DateScheduleDateFilter, DateScheduleDateFilterConfig } from './date.schedule';
import { LimitDateTimeConfig, LimitDateTimeInstance } from './date.time.limit';

export interface DateTimeMinuteConfig extends LimitDateTimeConfig {
  /**
   * Default date to consider.
   */
  date?: Date;
  /**
   * Number of minutes each "step" is.
   */
  step?: Minutes;
  /**
   * Additional behavior
   */
  behavior?: {
    /**
     * Whether or not to set the date to the min if the steps go above it.
     */
    capToMinLimit?: boolean;

    /**
     * Whether or not to set the date to the max if the steps go above it.
     */
    capToMaxLimit?: boolean;
  };
  /**
   * Schedule to filter the days to.
   */
  schedule?: DateScheduleDateFilterConfig;
}

/**
 * Current state of the date in the instance.
 */
export interface DateTimeMinuteDateStatus {
  /**
   * If the date is at the minimum value.
   */
  isAfterMinimum: boolean;

  /**
   * If thte date is at the maximum value.
   */
  isBeforeMaximum: boolean;

  /**
   * If the date is in the future.
   */
  inFuture: boolean;

  /**
   * If the date is in the future at the minimum number of future minutes requested.
   */
  inFutureMinutes: boolean;

  /**
   * If the date is in the past.
   */
  inPast: boolean;

  /**
   * If the date is on a schedule day.
   */
  isInSchedule: boolean;
}

export interface RoundDateTimeMinute extends StepRoundDateTimeDown {
  roundToBound?: boolean;
}

/**
 * Instance for working with a single date/time.
 *
 * Can step the date forward/backwards, and validate.
 */
export class DateTimeMinuteInstance {
  private _date: Date;
  private _step: Minutes;
  private _limit: LimitDateTimeInstance;
  private _dateFilter: DateScheduleDateFilter;

  constructor(readonly config: DateTimeMinuteConfig = {}, dateOverride?: Date | null) {
    this._date = (dateOverride == undefined ? config.date : dateOverride) || new Date();
    this._step = config.step ?? 1;
    this._limit = new LimitDateTimeInstance(config);
    this._dateFilter = config.schedule ? dateScheduleDateFilter(config.schedule) : () => true;
  }

  get date(): Date {
    return this._date;
  }

  set date(date: Date) {
    this._date = date;
  }

  get step(): Minutes {
    return this._step;
  }

  set step(step: Minutes) {
    this._step = step;
  }

  /**
   * Returns true if the input is within the range and in the schedule.
   *
   * @param date
   * @returns
   */
  isInValidRange(date?: Date): boolean {
    const result = this.getStatus(date);
    return result.isAfterMinimum && result.isBeforeMaximum && result.isInSchedule;
  }

  /**
   * Returns true if the status is completely valid.
   *
   * @param date
   * @returns
   */
  isValid(date?: Date): boolean {
    const result = this.getStatus(date);
    return result.isAfterMinimum && result.isBeforeMaximum && result.inFuture && result.inFutureMinutes && result.inPast && result.isInSchedule;
  }

  getStatus(date = this.date): DateTimeMinuteDateStatus {
    let isBeforeMaximum = true;
    let isAfterMinimum = true;
    let inFuture = true;
    let inFutureMinutes = true;
    let inPast = true;
    let isInSchedule = true;

    const { limits = {} } = this._limit.config;
    const { minimumMinutesIntoFuture } = this._limit;
    const now = roundDownToMinute(new Date());

    // Min/Future
    if (limits.min) {
      isAfterMinimum = isAfter(date, limits.min);
    }

    if (minimumMinutesIntoFuture) {
      const minFutureDateTime = addMinutes(now, minimumMinutesIntoFuture);
      inFutureMinutes = isAfter(now, minFutureDateTime);
    } else if (limits.isFuture) {
      inFuture = isAfter(date, now);
    }

    // Max/Past
    if (limits.max) {
      isBeforeMaximum = isBefore(date, limits.max);
    }

    if (limits.isPast) {
      inPast = isBefore(date, now);
    }

    // Schedule
    isInSchedule = this._dateFilter(date);

    return {
      isBeforeMaximum,
      isAfterMinimum,
      inFuture,
      inFutureMinutes,
      inPast,
      isInSchedule
    };
  }

  round(round: RoundDateTimeMinute): Date {
    let date = roundDateTimeDownToSteps(this.date, {
      ...round,
      step: round.step ?? this.step
    });

    if (round.roundToBound) {
      date = this._takeBoundedDate(date);
    }

    return date;
  }

  limit(date = this.date): Date {
    return this._limit.limit(date);
  }

  protected _takeBoundedDate(date = this.date): Date {
    return this._takeMaximumBoundedDate(this._takeMinimumBoundedDate(date));
  }

  protected _takeMinimumBoundedDate(date = this.date): Date {
    if (this.config.behavior?.capToMinLimit !== false) {
      const min = dateFromLogicalDate(this._limit.min);

      if (min && isBefore(date, min)) {
        date = min;
      }
    }

    return date;
  }

  protected _takeMaximumBoundedDate(date = this.date): Date {
    if (this.config.behavior?.capToMaxLimit !== false) {
      const max = dateFromLogicalDate(this._limit.max);

      if (max && isAfter(date, max)) {
        date = max;
      }
    }

    return date;
  }
}

/**
 * Creates a DecisionFunction for the input Date value.
 *
 * @param config
 * @returns
 */
export function dateTimeMinuteDecisionFunction(config: DateTimeMinuteConfig): DecisionFunction<Date> {
  const instance = new DateTimeMinuteInstance(config, null);
  return (date: Date) => instance.isValid(date);
}
