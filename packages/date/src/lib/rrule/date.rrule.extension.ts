import { type Maybe } from '@dereekb/util';
import { maxFutureDate } from '../date/date';
import { RRule } from 'rrule';

/**
 * Internal iteration arguments used by the RRule iteration engine.
 *
 * Mirrors the shape expected by RRule's `_iter` method for custom iteration control.
 */
export interface IterArgs {
  inc: boolean;
  before: Date;
  after: Date;
  dt: Date;
  _value: Date | Date[] | null;
}

// TODO: Fix typings in RRule, or better yet, add the given types up to RRule.

/**
 * Safety limit to prevent infinite iteration over unbounded recurrence rules.
 */
export const DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED = 10000;

/**
 * Extended RRule that adds convenience methods for querying recurrence dates
 * using custom iteration strategies (`last`, `next`, `any`).
 *
 * Works around missing typings in the upstream RRule library.
 *
 * @example
 * ```ts
 * const rule = new DateRRule({ freq: RRule.DAILY, dtstart: new Date() });
 * const lastDate = rule.last();
 * const nextDate = rule.next(new Date());
 * const hasAny = rule.any({ minDate: startDate, maxDate: endDate });
 * ```
 */
export class DateRRule extends RRule {
  /**
   * Returns the last occurrence in the rule chain, up to the configured max iteration limit.
   *
   * @example
   * ```ts
   * const rule = new DateRRule({ freq: RRule.DAILY, count: 5, dtstart: startDate });
   * const lastDate = rule.last(); // fifth occurrence
   * ```
   */
  last(): Maybe<Date> {
    return this._iter(new LastIterResult());
  }

  /**
   * Returns the first recurrence that occurs on or after the given date.
   *
   * @example
   * ```ts
   * const rule = new DateRRule({ freq: RRule.WEEKLY, dtstart: startDate });
   * const nextDate = rule.next(new Date());
   * ```
   */
  next(minDate: Date): Maybe<Date> {
    return this._iter(new NextIterResult(minDate));
  }

  /**
   * Checks whether any recurrence falls within the optional date bounds.
   *
   * @example
   * ```ts
   * const rule = new DateRRule({ freq: RRule.DAILY, dtstart: startDate });
   * const exists = rule.any({ minDate: rangeStart, maxDate: rangeEnd });
   * ```
   */
  any(filter: { minDate?: Maybe<Date>; maxDate?: Maybe<Date> } = {}): boolean {
    return this._iter(new AnyIterResult(filter)) != null;
  }
}

/**
 * Used for typing information. Unused otherwise.
 */
abstract class BaseRRuleIter {
  readonly method = 'before';
  readonly minDate: Date | null = undefined as unknown as Date;
  readonly maxDate: Date | null = undefined as unknown as Date;
  readonly _result: Date[] = undefined as unknown as Date[];
  readonly args: Partial<IterArgs> = undefined as unknown as Partial<IterArgs>;
  public total: number = 0;
  protected _value: Date | null = null;

  getValue(): Date | null {
    return this._value;
  }
}

/**
 * Iterator result that captures the last date encountered before reaching the max future date
 * or the iteration limit. Used by {@link DateRRule.last}.
 */
export class LastIterResult extends BaseRRuleIter {
  private readonly _maxIterationsAllowed: number;

  override readonly maxDate = maxFutureDate();

  constructor(maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED) {
    super();
    this._maxIterationsAllowed = maxIterationsAllowed;
  }

  get maxIterationsAllowed() {
    return this._maxIterationsAllowed;
  }

  accept(date: Date): boolean {
    ++this.total;

    const tooLate = date > this.maxDate;

    if (tooLate) {
      return false;
    } else {
      this.add(date);
      const maxIterationReached = this.total >= this._maxIterationsAllowed;
      return !maxIterationReached;
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return true;
  }

  clone() {
    return new LastIterResult(this._maxIterationsAllowed);
  }
}

/**
 * Iterator result that finds the first recurrence on or after a minimum date.
 * Stops iteration as soon as a qualifying date is found. Used by {@link DateRRule.next}.
 */
export class NextIterResult extends BaseRRuleIter {
  override readonly maxDate: Date;

  constructor(
    override readonly minDate: Date,
    readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED
  ) {
    super();
    this.maxDate = minDate;
  }

  accept(date: Date): boolean {
    this.total += 1;
    const tooEarly = this.minDate > date;

    if (tooEarly) {
      const maxIterationReached = this.total >= this.maxIterationsAllowed;
      return !maxIterationReached;
    } else {
      this.add(date);
      return false;
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return false;
  }

  clone() {
    return new NextIterResult(this.minDate, this.maxIterationsAllowed);
  }
}

/**
 * Iterator result that checks whether any recurrence falls within an optional date range.
 * Stops as soon as one qualifying date is found. Used by {@link DateRRule.any}.
 */
export class AnyIterResult extends BaseRRuleIter {
  override readonly minDate: Date | null = null;
  override readonly maxDate: Date | null = null;

  constructor(
    filter?: { minDate?: Maybe<Date>; maxDate?: Maybe<Date> },
    readonly maxIterationsAllowed: number = DEFAULT_LAST_ITER_RESULT_MAX_ITERATIONS_ALLOWED
  ) {
    super();
    if (filter) {
      this.minDate = filter.minDate ?? null;
      this.maxDate = filter.maxDate ?? null;
    }
  }

  accept(date: Date): boolean {
    ++this.total;
    const tooEarly = this.minDate != null && this.minDate > date;

    if (tooEarly) {
      const maxIterationReached = this.total >= this.maxIterationsAllowed;
      return !maxIterationReached;
    } else {
      const tooLate = this.maxDate != null && this.maxDate < date;

      if (tooLate) {
        return true;
      } else {
        this.add(date);
        return false;
      }
    }
  }

  add(date: Date): boolean {
    this._value = date;
    return false;
  }

  clone() {
    return new AnyIterResult({ minDate: this.minDate, maxDate: this.maxDate });
  }
}
