import { type Minutes, type DecisionFunction, type DateRelativeDirection, type Days, type Maybe } from '@dereekb/util';
import { addMinutes, differenceInDays, endOfDay, isAfter, isBefore, startOfDay } from 'date-fns';
import { roundDownToMinute } from './date';
import { roundDateTimeDownToSteps, type StepRoundDateTimeDown } from './date.round';
import { dateCellScheduleDateFilter, findNextDateInDateCellScheduleFilter, type DateCellScheduleDateFilter, type DateCellScheduleDateFilterConfig, type DateCellScheduleDateFilterInput } from './date.cell.schedule';
import { type LimitDateTimeConfig, LimitDateTimeInstance } from './date.time.limit';
import { dateFromLogicalDate } from './date.logical';
import { type DateRange, dateRangeFromStartAndEndOfDay, dateRangeOverlapsDateRange } from './date.range';

export interface DateTimeMinuteConfig extends LimitDateTimeConfig {
  /**
   * Default date to consider.
   */
  readonly date?: Date;
  /**
   * Number of minutes each "step" is.
   */
  readonly step?: Minutes;
  /**
   * Additional behavior
   */
  readonly behavior?: {
    /**
     * Whether or not to set the date to the min if the steps go above it.
     */
    readonly capToMinLimit?: boolean;

    /**
     * Whether or not to set the date to the max if the steps go above it.
     */
    readonly capToMaxLimit?: boolean;
  };
  /**
   * Schedule to filter the days to.
   */
  readonly schedule?: DateCellScheduleDateFilterConfig;
}

/**
 * Current state of the date in the instance.
 */
export interface DateTimeMinuteDateStatus {
  /**
   * If the date is at the minimum value.
   */
  readonly isAfterMinimum: boolean;

  /**
   * If thte date is at the maximum value.
   */
  readonly isBeforeMaximum: boolean;

  /**
   * If the date is in the future.
   */
  readonly inFuture: boolean;

  /**
   * If the date is in the future at the minimum number of future minutes requested.
   */
  readonly inFutureMinutes: boolean;

  /**
   * If the date is in the past.
   */
  readonly inPast: boolean;

  /**
   * If the date is on a schedule day.
   */
  readonly isInSchedule: boolean;
}

export interface RoundDateTimeMinute extends StepRoundDateTimeDown {
  readonly roundToBound?: boolean;
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
  private _dateFilter: Maybe<DateCellScheduleDateFilter>;

  constructor(readonly config: DateTimeMinuteConfig = {}, dateOverride?: Date | null) {
    this._date = (dateOverride == undefined ? config.date : dateOverride) || new Date();
    this._step = config.step ?? 1;
    this._limit = new LimitDateTimeInstance(config);
    this._dateFilter = config.schedule ? dateCellScheduleDateFilter(config.schedule) : undefined;
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
   * Returns the LimitDateTimeInstance. This does not take the schedule into consideration.
   */
  get limitInstance() {
    return this._limit;
  }

  /**
   * Returns true if the input date is on the schedule and possibly holds a valid value for the limit.
   *
   * @param date
   */
  dateDayContainsValidDateValue(date: Date) {
    const isInSchedule = this.dateIsInSchedule(date);
    let dateDayContainsValidDateValue = false;

    if (isInSchedule) {
      const limitRange = this._limit.dateRange();

      if (limitRange.start == null && limitRange.end == null) {
        dateDayContainsValidDateValue = true; // no limit
      } else {
        const dateStartAndEnd = dateRangeFromStartAndEndOfDay(date);

        if (limitRange.start != null && limitRange.end != null) {
          dateDayContainsValidDateValue = dateRangeOverlapsDateRange(dateStartAndEnd, limitRange as DateRange); // true if there is any overlap at all
        } else if (limitRange.start != null) {
          dateDayContainsValidDateValue = !isAfter(limitRange.start, dateStartAndEnd.end);
        } else if (limitRange.end != null) {
          dateDayContainsValidDateValue = !isBefore(limitRange.end, dateStartAndEnd.start);
        }
      }
    }

    return dateDayContainsValidDateValue;
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
      const logicalMin = dateFromLogicalDate(limits.min);
      isAfterMinimum = !isBefore(date, logicalMin);
    }

    if (minimumMinutesIntoFuture) {
      const minFutureDateTime = addMinutes(now, minimumMinutesIntoFuture);
      inFutureMinutes = !isBefore(now, minFutureDateTime);
    } else if (limits.isFuture) {
      inFuture = isAfter(date, now);
    }

    // Max/Past
    if (limits.max) {
      const logicalMax = dateFromLogicalDate(limits.max);
      isBeforeMaximum = !isAfter(date, logicalMax);
    }

    if (limits.isPast) {
      inPast = isBefore(date, now);
    }

    // Schedule
    isInSchedule = this.dateIsInSchedule(date);

    return {
      isBeforeMaximum,
      isAfterMinimum,
      inFuture,
      inFutureMinutes,
      inPast,
      isInSchedule
    };
  }

  dateIsInSchedule(date = this.date): boolean {
    return this._dateFilter ? this._dateFilter(date) : true; // true if no date filter
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

  clamp(date = this.date, maxClampDistance?: Days): Date {
    return this.clampToSchedule(this.clampToLimit(date), maxClampDistance);
  }

  clampToLimit(date = this.date): Date {
    return this._limit.clamp(date);
  }

  clampToSchedule(date = this.date, maxClampDistance: Days = 370): Date {
    let nextAvailableDate: Maybe<Date>;

    if (this._dateFilter != null) {
      const maxLimitedDateRange = this._limit.dateRange();

      if (this._dateFilter(date)) {
        nextAvailableDate = date;
      } else {
        const maxPastDistance = Math.min(maxClampDistance, maxLimitedDateRange.start ? Math.abs(differenceInDays(date, maxLimitedDateRange.start)) : maxClampDistance); // max future
        const maxFutureDistance = Math.min(maxClampDistance, maxLimitedDateRange.end ? Math.abs(differenceInDays(date, maxLimitedDateRange.end)) : maxClampDistance); // max future

        const nextFutureDate = findNextDateInDateCellScheduleFilter({
          date,
          filter: this._dateFilter,
          direction: 'future',
          maxDistance: maxFutureDistance,
          excludeInputDate: true
        });

        if (nextFutureDate != null) {
          nextAvailableDate = nextFutureDate.date;
        } else {
          // check the past date clamp
          const previousPastDate = findNextDateInDateCellScheduleFilter({
            date,
            filter: this._dateFilter,
            direction: 'past',
            maxDistance: maxPastDistance,
            excludeInputDate: true
          });

          if (previousPastDate != null) {
            nextAvailableDate = previousPastDate.date;
          }
        }

        // set a default from the given input if applicable
        if (nextAvailableDate == null) {
          nextAvailableDate = this.clampToLimit(date);
        }
      }
    }

    return nextAvailableDate ?? date;
  }

  findNextAvailableDayInSchedule(date: DateCellScheduleDateFilterInput, direction: DateRelativeDirection, maxDistance: Days = 370): Maybe<Date> {
    let nextAvailableDate: Maybe<Date>;

    if (this._dateFilter) {
      const result = findNextDateInDateCellScheduleFilter({
        date,
        filter: this._dateFilter,
        direction,
        maxDistance: maxDistance,
        excludeInputDate: true
      });

      if (result != null) {
        nextAvailableDate = result.date;
      }
    }

    return nextAvailableDate;
  }

  isInSchedule(date: DateCellScheduleDateFilterInput) {
    return this._dateFilter ? this._dateFilter(date) : true;
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

/**
 * Similar to dateTimeMinuteDecisionFunction(), but compares the first and last instant of the input day to determine the decision.
 *
 * @param config
 * @param startAndEndOfDayMustBeValid Whether or not the start of the day and end of the day must be valid to be considered valid. Defaults to false.
 * @returns
 */
export function dateTimeMinuteWholeDayDecisionFunction(config: DateTimeMinuteConfig, startAndEndOfDayMustBeValid = false): DecisionFunction<Date> {
  const instance = new DateTimeMinuteInstance(config, null);

  if (startAndEndOfDayMustBeValid) {
    return (date: Date) => instance.isValid(startOfDay(date)) && instance.isValid(endOfDay(date));
  } else {
    return (date: Date) => instance.dateDayContainsValidDateValue(date);
  }
}
