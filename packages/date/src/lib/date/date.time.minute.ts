import { type Minutes, type DecisionFunction, type DateRelativeDirection, type Days, type Maybe } from '@dereekb/util';
import { addMinutes, differenceInDays, endOfDay, isAfter, isBefore, startOfDay } from 'date-fns';
import { roundDownToMinute } from './date';
import { roundDateTimeDownToSteps, type StepRoundDateTimeDown } from './date.round';
import { dateCellScheduleDateFilter, findNextDateInDateCellScheduleFilter, type DateCellScheduleDateFilter, type DateCellScheduleDateFilterConfig, type DateCellScheduleDateFilterInput } from './date.cell.schedule';
import { type LimitDateTimeConfig, LimitDateTimeInstance } from './date.time.limit';
import { dateFromLogicalDate } from './date.logical';
import { type DateRange, dateRangeFromStartAndEndOfDay, dateRangeOverlapsDateRange } from './date.range';

/**
 * Configuration for a {@link DateTimeMinuteInstance} that combines time limits, step intervals, and schedule filtering
 * to control which date/time values are considered valid.
 *
 * @example
 * ```ts
 * const config: DateTimeMinuteConfig = {
 *   date: new Date('2024-01-15T10:00:00'),
 *   step: 15,
 *   limits: { isFuture: true },
 *   behavior: { capToMinLimit: true, capToMaxLimit: true },
 *   schedule: { w: '0111110' } // weekdays only
 * };
 *
 * const instance = new DateTimeMinuteInstance(config);
 * ```
 */
export interface DateTimeMinuteConfig extends LimitDateTimeConfig {
  /**
   * Default date to consider. Falls back to the current date/time if not provided.
   */
  readonly date?: Date;
  /**
   * Minute interval for stepping and rounding. Defaults to 1.
   */
  readonly step?: Minutes;
  /**
   * Controls clamping behavior when a date exceeds configured limits.
   */
  readonly behavior?: {
    /**
     * When true, rounds/clamps values that fall below the minimum up to the minimum instead of leaving them out of range. Defaults to true.
     */
    readonly capToMinLimit?: boolean;

    /**
     * When true, rounds/clamps values that exceed the maximum down to the maximum instead of leaving them out of range. Defaults to true.
     */
    readonly capToMaxLimit?: boolean;
  };
  /**
   * Optional schedule that restricts which days are considered valid. Useful for excluding weekends or specific dates.
   */
  readonly schedule?: DateCellScheduleDateFilterConfig;
}

/**
 * Validation status snapshot for a date evaluated against a {@link DateTimeMinuteInstance}'s constraints.
 * Each field defaults to `true` when its corresponding constraint is not configured,
 * so only actively violated constraints will be `false`.
 */
export interface DateTimeMinuteDateStatus {
  /**
   * Whether the date is at or after the configured minimum limit.
   */
  readonly isAfterMinimum: boolean;

  /**
   * Whether the date is at or before the configured maximum limit.
   */
  readonly isBeforeMaximum: boolean;

  /**
   * Whether the date satisfies the `isFuture` constraint.
   */
  readonly inFuture: boolean;

  /**
   * Whether the date satisfies the `minimumMinutesIntoFuture` constraint.
   */
  readonly inFutureMinutes: boolean;

  /**
   * Whether the date satisfies the `isPast` constraint.
   */
  readonly inPast: boolean;

  /**
   * Whether the date falls on a day included in the configured schedule.
   */
  readonly isInSchedule: boolean;
}

/**
 * Rounding options for {@link DateTimeMinuteInstance.round} that extend step-based rounding
 * with optional clamping to configured min/max bounds.
 */
export interface RoundDateTimeMinute extends StepRoundDateTimeDown {
  /**
   * When true, clamps the rounded result to the configured min/max limits
   * so it never falls outside the valid range.
   */
  readonly roundToBound?: boolean;
}

/**
 * Manages a mutable date/time value with step-based rounding, min/max limit enforcement,
 * and schedule-aware validation. Combines {@link LimitDateTimeInstance} constraints with
 * {@link DateCellScheduleDateFilter} to determine valid date/time values.
 *
 * @example
 * ```ts
 * const instance = new DateTimeMinuteInstance({
 *   date: new Date('2024-06-15T09:07:00'),
 *   step: 15,
 *   limits: { min: new Date('2024-06-01'), max: new Date('2024-12-31') },
 *   schedule: { w: '0111110' }
 * });
 *
 * const rounded = instance.round({ roundToSteps: true });
 * const clamped = instance.clamp();
 * const status = instance.getStatus();
 * ```
 */
export class DateTimeMinuteInstance {
  private _config: DateTimeMinuteConfig;
  private _date: Date;
  private _step: Minutes;
  private _limit: LimitDateTimeInstance;
  private _dateFilter: Maybe<DateCellScheduleDateFilter>;

  constructor(config: DateTimeMinuteConfig = {}, dateOverride?: Date | null) {
    this._config = config;
    this._date = (dateOverride == undefined ? config.date : dateOverride) || new Date();
    this._step = config.step ?? 1;
    this._limit = new LimitDateTimeInstance(config);
    this._dateFilter = config.schedule ? dateCellScheduleDateFilter(config.schedule) : undefined;
  }

  get config() {
    return this._config;
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
   * Checks whether any moment within the given date's day could be valid, considering
   * both the schedule and the configured min/max limits. Useful for calendar UIs to
   * determine which days should be selectable.
   *
   * @param date - the date whose day to evaluate
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   limits: { min: new Date('2024-06-15T14:00:00') },
   *   schedule: { w: '0111110' }
   * });
   *
   * // true if June 15 is a weekday and overlaps the limit range
   * instance.dateDayContainsValidDateValue(new Date('2024-06-15'));
   * ```
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
   * Checks whether the date satisfies the min/max limits and falls on a scheduled day.
   * Unlike {@link isValid}, this does not check future/past constraints.
   *
   * @param date - date to check; defaults to the instance's current date
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   limits: { min: new Date('2024-01-01'), max: new Date('2024-12-31') },
   *   schedule: { w: '0111110' }
   * });
   *
   * instance.isInValidRange(new Date('2024-06-15T10:00:00')); // true if a weekday
   * ```
   */
  isInValidRange(date?: Date): boolean {
    const result = this.getStatus(date);
    return result.isAfterMinimum && result.isBeforeMaximum && result.isInSchedule;
  }

  /**
   * Checks whether the date passes all configured constraints: min/max limits,
   * future/past requirements, minimum future minutes, and schedule.
   *
   * @param date - date to check; defaults to the instance's current date
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   limits: { isFuture: true, min: new Date('2024-01-01') },
   *   schedule: { w: '0111110' }
   * });
   *
   * instance.isValid(new Date('2099-03-15T10:00:00')); // true if all constraints pass
   * ```
   */
  isValid(date?: Date): boolean {
    const result = this.getStatus(date);
    return result.isAfterMinimum && result.isBeforeMaximum && result.inFuture && result.inFutureMinutes && result.inPast && result.isInSchedule;
  }

  /**
   * Evaluates the date against all configured constraints and returns a detailed status.
   * Fields default to `true` when their corresponding constraint is not configured.
   *
   * @param date - date to evaluate; defaults to the instance's current date
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   limits: { min: new Date('2024-01-01'), isFuture: true }
   * });
   *
   * const status = instance.getStatus(new Date('2023-06-01'));
   * // status.isAfterMinimum === false (before min)
   * // status.inFuture === false (if date is in the past)
   * ```
   */
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

  /**
   * Checks whether the date falls on a day included in the configured schedule.
   * Always returns `true` if no schedule is configured.
   *
   * @param date - date to check; defaults to the instance's current date
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   schedule: { w: '0111110' } // weekdays only
   * });
   *
   * instance.dateIsInSchedule(new Date('2024-06-15')); // true (Saturday = false)
   * ```
   */
  dateIsInSchedule(date = this.date): boolean {
    return this._dateFilter ? this._dateFilter(date) : true; // true if no date filter
  }

  /**
   * Rounds the instance's current date down to the configured step interval,
   * optionally clamping the result to the min/max bounds.
   *
   * @param round - rounding and clamping options
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   date: new Date('2024-06-15T09:07:00'),
   *   step: 15,
   *   limits: { min: new Date('2024-06-15T09:00:00') }
   * });
   *
   * instance.round({ roundToSteps: true }); // 2024-06-15T09:00:00
   * instance.round({ roundToSteps: true, roundToBound: true }); // clamped to min if below
   * ```
   */
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

  /**
   * Clamps the date to both the configured limits and the schedule by first applying
   * {@link clampToLimit}, then {@link clampToSchedule}.
   *
   * @param date - date to clamp; defaults to the instance's current date
   * @param maxClampDistance - maximum number of days to search for a valid schedule day
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   limits: { min: new Date('2024-06-01') },
   *   schedule: { w: '0111110' }
   * });
   *
   * instance.clamp(new Date('2024-05-25')); // clamped to min, then nearest weekday
   * ```
   */
  clamp(date = this.date, maxClampDistance?: Days): Date {
    return this.clampToSchedule(this.clampToLimit(date), maxClampDistance);
  }

  /**
   * Clamps the date to the configured min/max limits without considering the schedule.
   *
   * @param date - date to clamp; defaults to the instance's current date
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   limits: { min: new Date('2024-06-01'), max: new Date('2024-12-31') }
   * });
   *
   * instance.clampToLimit(new Date('2025-03-01')); // returns max (2024-12-31)
   * ```
   */
  clampToLimit(date = this.date): Date {
    return this._limit.clamp(date);
  }

  /**
   * Finds the nearest valid schedule day for the given date. Searches forward first,
   * then backward, within the configured limits and max distance. Returns the input
   * date unchanged if no schedule is configured or the date is already on a valid day.
   *
   * @param date - date to clamp; defaults to the instance's current date
   * @param maxClampDistance - maximum number of days to search in each direction; defaults to 370
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   schedule: { w: '0111110' } // weekdays only
   * });
   *
   * // If June 15, 2024 is a Saturday, returns the next Monday
   * instance.clampToSchedule(new Date('2024-06-15'));
   * ```
   */
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

  /**
   * Searches for the next day in the configured schedule in the given direction,
   * excluding the input date itself. Returns `undefined` if no schedule is configured
   * or no matching day is found within the max distance.
   *
   * @param date - starting date for the search
   * @param direction - whether to search forward ('future') or backward ('past')
   * @param maxDistance - maximum number of days to search; defaults to 370
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   schedule: { w: '0111110' } // weekdays only
   * });
   *
   * // Find the next weekday after a Saturday
   * instance.findNextAvailableDayInSchedule(new Date('2024-06-15'), 'future');
   * ```
   */
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

  /**
   * Checks whether the given date falls on a scheduled day. Always returns `true` if no schedule is configured.
   * Accepts any {@link DateCellScheduleDateFilterInput} value (Date, number, or LogicalDate).
   *
   * @param date - date to check against the schedule
   *
   * @example
   * ```ts
   * const instance = new DateTimeMinuteInstance({
   *   schedule: { w: '0111110' }
   * });
   *
   * instance.isInSchedule(new Date('2024-06-17')); // true (Monday)
   * instance.isInSchedule(new Date('2024-06-16')); // false (Sunday)
   * ```
   */
  isInSchedule(date: DateCellScheduleDateFilterInput) {
    return this._dateFilter ? this._dateFilter(date) : true;
  }

  protected _takeBoundedDate(date = this.date): Date {
    return this._takeMaximumBoundedDate(this._takeMinimumBoundedDate(date));
  }

  protected _takeMinimumBoundedDate(date = this.date): Date {
    if (this._config.behavior?.capToMinLimit !== false) {
      const min = dateFromLogicalDate(this._limit.min);

      if (min && isBefore(date, min)) {
        date = min;
      }
    }

    return date;
  }

  protected _takeMaximumBoundedDate(date = this.date): Date {
    if (this._config.behavior?.capToMaxLimit !== false) {
      const max = dateFromLogicalDate(this._limit.max);

      if (max && isAfter(date, max)) {
        date = max;
      }
    }

    return date;
  }
}

/**
 * Creates a {@link DecisionFunction} that evaluates whether a given date passes all
 * constraints defined in the config (limits, future/past, schedule).
 * Uses {@link DateTimeMinuteInstance.isValid} internally.
 *
 * @param config - configuration defining the valid date constraints
 *
 * @example
 * ```ts
 * const isValid = dateTimeMinuteDecisionFunction({
 *   limits: { isFuture: true, min: new Date('2024-01-01') },
 *   schedule: { w: '0111110' }
 * });
 *
 * isValid(new Date('2024-06-17T10:00:00')); // true if future weekday after min
 * ```
 */
export function dateTimeMinuteDecisionFunction(config: DateTimeMinuteConfig): DecisionFunction<Date> {
  const instance = new DateTimeMinuteInstance(config, null);
  return (date: Date) => instance.isValid(date);
}

/**
 * Creates a {@link DecisionFunction} that evaluates an entire day rather than a specific instant.
 * Useful for calendar UIs where you need to enable/disable entire days.
 *
 * When `startAndEndOfDayMustBeValid` is true, both the start and end of the day must pass
 * {@link DateTimeMinuteInstance.isValid}. When false (default), uses
 * {@link DateTimeMinuteInstance.dateDayContainsValidDateValue} to check if any moment
 * in the day could be valid.
 *
 * @param config - configuration defining the valid date constraints
 * @param startAndEndOfDayMustBeValid - when true, requires the entire day to be valid rather than just part of it
 *
 * @example
 * ```ts
 * const isDayValid = dateTimeMinuteWholeDayDecisionFunction({
 *   limits: { min: new Date('2024-06-15T14:00:00') },
 *   schedule: { w: '0111110' }
 * });
 *
 * // true if any part of June 15 is valid and it's a weekday
 * isDayValid(new Date('2024-06-15'));
 *
 * const isFullDayValid = dateTimeMinuteWholeDayDecisionFunction(config, true);
 * // true only if both 00:00 and 23:59 on June 15 pass all constraints
 * isFullDayValid(new Date('2024-06-15'));
 * ```
 */
export function dateTimeMinuteWholeDayDecisionFunction(config: DateTimeMinuteConfig, startAndEndOfDayMustBeValid = false): DecisionFunction<Date> {
  const instance = new DateTimeMinuteInstance(config, null);

  if (startAndEndOfDayMustBeValid) {
    return (date: Date) => instance.isValid(startOfDay(date)) && instance.isValid(endOfDay(date));
  } else {
    return (date: Date) => instance.dateDayContainsValidDateValue(date);
  }
}
